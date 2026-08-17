import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Tenant } from './tenant.model';
import { Patient } from './patient.model';
import { Appointment } from './appointment.model';

/**
 * A medical report the patient uploaded against one appointment.
 * Tenant-scoped: a clinic must only ever see reports for its own appointments.
 */
@Table({
  tableName: 'patient_reports',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class PatientReport extends Model<PatientReport> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenant_id: string;

  @ForeignKey(() => Appointment)
  @Column({ type: DataType.UUID, allowNull: false })
  appointment_id: string;

  @ForeignKey(() => Patient)
  @Column({ type: DataType.UUID, allowNull: false })
  patient_id: string;

  /** S3 object key — never exposed raw, always via a presigned GET URL. */
  @Column({ type: DataType.STRING, allowNull: false })
  file_key: string;

  @Column({ type: DataType.STRING, allowNull: false })
  file_name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  mime_type: string;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 })
  size_bytes: number;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsTo(() => Appointment)
  appointment: Appointment;

  @BelongsTo(() => Patient)
  patient: Patient;
}
