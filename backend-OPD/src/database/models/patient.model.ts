import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { Gender } from '../../common/enums';

/**
 * A patient is GLOBAL, not tenant-owned: the mobile number is the person's
 * identity across every clinic on the platform. Tenant isolation is enforced on
 * what hangs off a patient (appointments, reports), never on the identity.
 */
@Table({
  tableName: 'patients',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class Patient extends Model<Patient> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  mobile: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  age: number | null;

  @Column({ type: DataType.STRING(10), allowNull: true })
  gender: Gender | null;

  /** True once the patient has supplied name + age + gender. */
  get isProfileComplete(): boolean {
    return Boolean(this.name && this.age != null && this.gender);
  }
}
