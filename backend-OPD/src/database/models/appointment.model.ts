import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import {
  AppointmentStatus,
  BookingSource,
  ConsultationStatus,
  PaymentStatus,
} from '../../common/enums';
import { Doctor } from './doctor.model';
import { Tenant } from './tenant.model';
import { Patient } from './patient.model';

@Table({
  tableName: 'appointments',
  timestamps: true,
  underscored: true,
})
export class Appointment extends Model<Appointment> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenant_id: string;

  @ForeignKey(() => Doctor)
  @Column({ type: DataType.UUID, allowNull: false })
  doctor_id: string;

  /**
   * Links to the global patient registry. Nullable: legacy rows and anonymous
   * public bookings may predate a patient record. The patient_name/mobile
   * columns below stay as a point-in-time snapshot of the booking.
   */
  @ForeignKey(() => Patient)
  @Column({ type: DataType.UUID, allowNull: true })
  patient_id: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  appointment_date: string;

  @Column({ type: DataType.TIME, allowNull: false })
  start_time: string;

  @Column({ type: DataType.TIME, allowNull: false })
  end_time: string;

  @Column({ type: DataType.STRING, allowNull: false })
  patient_name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  patient_mobile: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  patient_address: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  description: string | null;

  /** Doctor's free-text note, referred to on the patient's next OPD visit. */
  @Column({ type: DataType.TEXT, allowNull: true })
  doctor_notes: string | null;

  /** S3 object key for the uploaded payment screenshot. */
  @Column({ type: DataType.STRING, allowNull: false })
  payment_screenshot_url: string;

  /** Only `confirmed` occupies a slot (partial unique index). */
  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: AppointmentStatus.CONFIRMED,
  })
  status: AppointmentStatus;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: ConsultationStatus.PENDING,
  })
  consultation_status: ConsultationStatus;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: PaymentStatus.PAID_UNVERIFIED,
  })
  payment_status: PaymentStatus;

  @Column({ type: DataType.STRING, allowNull: false })
  source: BookingSource;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsTo(() => Doctor)
  doctor: Doctor;

  @BelongsTo(() => Patient)
  patient: Patient;
}
