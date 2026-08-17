'use strict';

/**
 * Patient registry + OTP verification + uploaded medical reports.
 *
 * `patients` and `patient_otps` are GLOBAL (no tenant_id): a person is one
 * identity across the whole platform, keyed by mobile, so they can browse and
 * book with doctors at any clinic and see all of it in one place.
 *
 * `patient_reports` IS tenant-scoped: a clinic must only ever see the reports
 * uploaded against its own appointments.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, INTEGER, DATE, BIGINT } = Sequelize;
    const now = Sequelize.literal('NOW()');

    await queryInterface.createTable('patients', {
      id: { type: UUID, defaultValue: UUIDV4, primaryKey: true },
      mobile: { type: STRING(20), allowNull: false, unique: true },
      name: { type: STRING, allowNull: false },
      age: { type: INTEGER, allowNull: true },
      gender: { type: STRING(10), allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: now },
      updated_at: { type: DATE, allowNull: false, defaultValue: now },
      deleted_at: { type: DATE, allowNull: true },
    });

    await queryInterface.createTable('patient_otps', {
      id: { type: UUID, defaultValue: UUIDV4, primaryKey: true },
      mobile: { type: STRING(20), allowNull: false },
      // Hashed, never the plain code — the log/SMS is the only place it appears.
      code_hash: { type: STRING, allowNull: false },
      expires_at: { type: DATE, allowNull: false },
      consumed_at: { type: DATE, allowNull: true },
      attempts: { type: INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DATE, allowNull: false, defaultValue: now },
      updated_at: { type: DATE, allowNull: false, defaultValue: now },
    });

    await queryInterface.createTable('patient_reports', {
      id: { type: UUID, defaultValue: UUIDV4, primaryKey: true },
      tenant_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      appointment_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'appointments', key: 'id' },
        onDelete: 'CASCADE',
      },
      patient_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
      },
      file_key: { type: STRING, allowNull: false },
      file_name: { type: STRING, allowNull: false },
      mime_type: { type: STRING, allowNull: false },
      size_bytes: { type: BIGINT, allowNull: false, defaultValue: 0 },
      created_at: { type: DATE, allowNull: false, defaultValue: now },
      updated_at: { type: DATE, allowNull: false, defaultValue: now },
      deleted_at: { type: DATE, allowNull: true },
    });

    // Link existing appointments to the patient registry (nullable: legacy rows
    // and anonymous public bookings predate a patient record).
    await queryInterface.addColumn('appointments', 'patient_id', {
      type: UUID,
      allowNull: true,
      references: { model: 'patients', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('patients', ['mobile'], {
      name: 'patients_mobile_idx',
    });
    await queryInterface.addIndex('patient_otps', ['mobile', 'expires_at'], {
      name: 'patient_otps_mobile_expires_idx',
    });
    await queryInterface.addIndex('patient_reports', ['appointment_id'], {
      name: 'patient_reports_appointment_idx',
    });
    await queryInterface.addIndex('patient_reports', ['tenant_id'], {
      name: 'patient_reports_tenant_idx',
    });
    await queryInterface.addIndex('patient_reports', ['patient_id'], {
      name: 'patient_reports_patient_idx',
    });
    await queryInterface.addIndex('appointments', ['patient_id'], {
      name: 'appointments_patient_idx',
    });

    // Backfill: create a patient per distinct mobile already in appointments so
    // existing bookings are reachable from the new "my appointments" view.
    await queryInterface.sequelize.query(`
      INSERT INTO patients (id, mobile, name, created_at, updated_at)
      SELECT gen_random_uuid(), a.patient_mobile, MIN(a.patient_name), NOW(), NOW()
      FROM appointments a
      WHERE a.patient_mobile IS NOT NULL AND a.patient_mobile <> ''
      GROUP BY a.patient_mobile
      ON CONFLICT (mobile) DO NOTHING;
    `);

    await queryInterface.sequelize.query(`
      UPDATE appointments a
      SET patient_id = p.id
      FROM patients p
      WHERE p.mobile = a.patient_mobile AND a.patient_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('appointments', 'appointments_patient_idx');
    await queryInterface.removeColumn('appointments', 'patient_id');
    await queryInterface.dropTable('patient_reports');
    await queryInterface.dropTable('patient_otps');
    await queryInterface.dropTable('patients');
  },
};
