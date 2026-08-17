'use strict';

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const MODULES = [
  'users',
  'roles',
  'doctors',
  'opd_schedules',
  'appointments',
  'dashboard',
  'tenant',
  'platform',
];
const ACTIONS = ['create', 'read', 'update', 'delete'];

/**
 * Seeds the global permission catalog and the platform SuperAdmin user.
 * Tenant roles (Owner, Nurse) are created per-tenant at registration time.
 * Idempotent — safe to re-run.
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const now = new Date();

    // ── 1. Permissions (global catalog) ──────────────────────
    const [existingPerms] = await sequelize.query(
      'SELECT id, module, action FROM permissions;',
    );
    const permKey = (m, a) => `${m}:${a}`;
    const existingSet = new Set(existingPerms.map((p) => permKey(p.module, p.action)));
    const permIdByKey = new Map(
      existingPerms.map((p) => [permKey(p.module, p.action), p.id]),
    );

    const toInsert = [];
    for (const module of MODULES) {
      for (const action of ACTIONS) {
        if (!existingSet.has(permKey(module, action))) {
          const id = randomUUID();
          permIdByKey.set(permKey(module, action), id);
          toInsert.push({ id, module, action, created_at: now, updated_at: now });
        }
      }
    }
    if (toInsert.length) {
      await queryInterface.bulkInsert('permissions', toInsert);
    }

    // ── 2. Platform SuperAdmin user (no tenant_id, no role row) ─
    // SuperAdmin bypasses all role/permission checks in the guard, so it needs
    // no role row. The permissions guard checks type === 'super_admin' first.
    const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@opd.local').toLowerCase();
    const [userRows] = await sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1;',
      { replacements: { email } },
    );
    if (!userRows[0]) {
      const password = process.env.SUPERADMIN_PASSWORD || 'change-me';
      const password_hash = await bcrypt.hash(password, 10);
      await queryInterface.bulkInsert('users', [{
        id: randomUUID(),
        name: process.env.SUPERADMIN_NAME || 'Super Admin',
        email,
        password_hash,
        type: 'super_admin',
        tenant_id: null,
        role_id: null,
        doctor_id: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      }]);
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@opd.local').toLowerCase();
    await sequelize.query('DELETE FROM users WHERE email = :email;', {
      replacements: { email },
    });
    await queryInterface.bulkDelete('permissions', null, {});
  },
};
