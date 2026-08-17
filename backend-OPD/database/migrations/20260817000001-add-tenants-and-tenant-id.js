'use strict';

/**
 * Multi-tenancy migration.
 *
 * Creates the `tenants` table, adds `tenant_id` to the six tenant-owned
 * tables, backfills a "Default Clinic" for existing rows, then sets
 * NOT NULL + adds the composite `(tenant_id, name)` unique on roles.
 *
 * The backfill runs inside a single transaction so NOT NULL is safe.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, TEXT, BOOLEAN, DATE } = Sequelize;
    const now = new Date();
    const { randomUUID } = require('crypto');

    const timestamps = {
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    };

    // ── 1. Create tenants ──────────────────────────────────────
    await queryInterface.createTable('tenants', {
      id: { type: UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, allowNull: false, unique: true },
      owner_user_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      contact_email: { type: STRING, allowNull: true },
      contact_phone: { type: STRING, allowNull: true },
      address: { type: TEXT, allowNull: true },
      logo_url: { type: STRING, allowNull: true },
      timezone: { type: STRING, allowNull: false, defaultValue: 'Asia/Kolkata' },
      status: { type: STRING, allowNull: false, defaultValue: 'active' },
      ...timestamps,
      deleted_at: { type: DATE, allowNull: true },
    });
    await queryInterface.addIndex('tenants', ['slug'], {
      unique: true,
      name: 'tenants_slug_uq',
    });

    // ── 2. Add nullable tenant_id to all tenant-owned tables ───
    const fk = (table) => ({
      type: UUID,
      allowNull: true,
      references: { model: 'tenants', key: 'id' },
      onDelete: table === 'users' ? 'SET NULL' : 'CASCADE',
    });

    await queryInterface.addColumn('roles', 'tenant_id', fk('roles'));
    await queryInterface.addColumn('doctors', 'tenant_id', fk('doctors'));
    await queryInterface.addColumn('users', 'tenant_id', fk('users'));
    await queryInterface.addColumn('opd_schedules', 'tenant_id', fk('opd_schedules'));
    await queryInterface.addColumn('schedule_exceptions', 'tenant_id', fk('schedule_exceptions'));
    await queryInterface.addColumn('appointments', 'tenant_id', fk('appointments'));

    // ── 3. Backfill: create Default Clinic, stamp all rows ─────
    const tenantId = randomUUID();

    // Find the existing doctor's linked user (owner candidate).
    const [doctorRows] = await queryInterface.sequelize.query(
      "SELECT u.id FROM users u WHERE u.doctor_id IS NOT NULL LIMIT 1;"
    );
    const ownerUserId = doctorRows[0]?.id ?? null;

    await queryInterface.bulkInsert('tenants', [{
      id: tenantId,
      name: 'Default Clinic',
      slug: 'default-clinic',
      owner_user_id: ownerUserId,
      timezone: 'Asia/Kolkata',
      status: 'active',
      created_at: now,
      updated_at: now,
    }]);

    // Stamp all existing non-super_admin users with the default tenant.
    await queryInterface.sequelize.query(
      "UPDATE users SET tenant_id = :tid WHERE type != 'super_admin';",
      { replacements: { tid: tenantId } }
    );
    await queryInterface.sequelize.query(
      "UPDATE roles SET tenant_id = :tid;",
      { replacements: { tid: tenantId } }
    );
    await queryInterface.sequelize.query(
      "UPDATE doctors SET tenant_id = :tid;",
      { replacements: { tid: tenantId } }
    );
    await queryInterface.sequelize.query(
      "UPDATE opd_schedules SET tenant_id = :tid;",
      { replacements: { tid: tenantId } }
    );
    await queryInterface.sequelize.query(
      "UPDATE schedule_exceptions SET tenant_id = :tid;",
      { replacements: { tid: tenantId } }
    );
    await queryInterface.sequelize.query(
      "UPDATE appointments SET tenant_id = :tid;",
      { replacements: { tid: tenantId } }
    );

    // ── 4. SET NOT NULL (users stays nullable for super_admin) ─
    await queryInterface.changeColumn('roles', 'tenant_id', {
      type: UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn('doctors', 'tenant_id', {
      type: UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn('opd_schedules', 'tenant_id', {
      type: UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn('schedule_exceptions', 'tenant_id', {
      type: UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn('appointments', 'tenant_id', {
      type: UUID,
      allowNull: false,
    });
    // users.tenant_id stays nullable (super_admin has NULL).

    // ── 5. Replace roles.name unique → (tenant_id, name) ──────
    await queryInterface.removeConstraint('roles', 'roles_name_key').catch(() =>
      queryInterface.removeIndex('roles', 'roles_name_key').catch(() => null)
    );
    await queryInterface.addIndex('roles', ['tenant_id', 'name'], {
      unique: true,
      name: 'roles_tenant_name_uq',
    });

    // ── 6. Performance indexes ─────────────────────────────────
    await queryInterface.addIndex('users', ['tenant_id'], {
      name: 'users_tenant_id_idx',
    });
    await queryInterface.addIndex('doctors', ['tenant_id', 'is_enabled'], {
      name: 'doctors_tenant_enabled_idx',
    });
    await queryInterface.addIndex('appointments', ['tenant_id', 'appointment_date'], {
      name: 'appointments_tenant_date_idx',
    });
  },

  async down(queryInterface) {
    // Remove indexes first.
    await queryInterface.removeIndex('appointments', 'appointments_tenant_date_idx').catch(() => null);
    await queryInterface.removeIndex('doctors', 'doctors_tenant_enabled_idx').catch(() => null);
    await queryInterface.removeIndex('users', 'users_tenant_id_idx').catch(() => null);

    // Restore roles.name unique.
    await queryInterface.removeIndex('roles', 'roles_tenant_name_uq').catch(() => null);
    await queryInterface.addIndex('roles', ['name'], {
      unique: true,
      name: 'roles_name_key',
    });

    // Drop tenant_id columns.
    for (const table of ['roles', 'doctors', 'users', 'opd_schedules', 'schedule_exceptions', 'appointments']) {
      await queryInterface.removeColumn(table, 'tenant_id');
    }

    // Drop tenants table.
    await queryInterface.dropTable('tenants');
  },
};
