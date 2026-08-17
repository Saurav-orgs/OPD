import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * One-time codes for patient login. Global (keyed by mobile, not tenant).
 * Only the hash is stored — the plain code exists solely in the delivered SMS
 * (or the dev console).
 */
@Table({
  tableName: 'patient_otps',
  timestamps: true,
  underscored: true,
})
export class PatientOtp extends Model<PatientOtp> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  mobile: string;

  @Column({ type: DataType.STRING, allowNull: false })
  code_hash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  expires_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  consumed_at: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  attempts: number;
}
