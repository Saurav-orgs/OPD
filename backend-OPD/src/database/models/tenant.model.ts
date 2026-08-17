import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from './user.model';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Table({
  tableName: 'tenants',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class Tenant extends Model<Tenant> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  slug: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true })
  owner_user_id: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  contact_email: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  contact_phone: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  address: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  logo_url: string | null;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'Asia/Kolkata' })
  timezone: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: TenantStatus.ACTIVE })
  status: TenantStatus;

  @BelongsTo(() => User, 'owner_user_id')
  owner: User;
}
