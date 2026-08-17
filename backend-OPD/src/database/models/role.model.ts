import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
  BelongsToMany,
  HasMany,
} from 'sequelize-typescript';
import { Permission } from './permission.model';
import { RolePermission } from './role-permission.model';
import { User } from './user.model';
import { Tenant } from './tenant.model';

@Table({ tableName: 'roles', timestamps: true, underscored: true })
export class Role extends Model<Role> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenant_id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  description: string | null;

  /** Protects built-in roles (e.g. SuperAdmin) from edit/delete. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  is_system: boolean;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsToMany(() => Permission, () => RolePermission)
  permissions: Permission[];

  @HasMany(() => User)
  users: User[];
}
