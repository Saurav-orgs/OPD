import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { User } from '../database/models/user.model';
import { Role } from '../database/models/role.model';
import { Permission } from '../database/models/permission.model';
import { Tenant } from '../database/models/tenant.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UserType } from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { TenantStatus } from '../database/models/tenant.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Role) private readonly roleModel: typeof Role,
  ) {}

  private readonly roleWithPerms = {
    model: Role,
    include: [{ model: Permission }],
  };

  async create(dto: CreateUserDto, callerTenantId?: string | null): Promise<User> {
    await this.assertEmailFree(dto.email);

    // Tenant users cannot create super_admin accounts.
    if (callerTenantId && dto.type === UserType.SUPER_ADMIN) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'You cannot create a platform admin account.',
      });
    }

    // If a role_id is given, it must belong to the same tenant.
    if (callerTenantId && dto.role_id) {
      const role = await this.roleModel.findByPk(dto.role_id);
      if (!role || role.tenant_id !== callerTenantId) {
        throw new AppException(ErrorCode.BAD_REQUEST, {
          message: 'Role does not belong to this practice.',
        });
      }
    }

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password_hash,
      type: dto.type,
      tenant_id: callerTenantId ?? null,
      role_id: dto.role_id ?? null,
      doctor_id: dto.type === UserType.DOCTOR ? (dto.doctor_id ?? null) : null,
      is_active: dto.is_active ?? true,
    } as any);
    return this.findOne(user.id);
  }

  async findAll(): Promise<User[]> {
    return this.userModel.findAll({
      include: [this.roleWithPerms, 'doctor'],
      order: [['created_at', 'DESC']],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id, {
      include: [this.roleWithPerms, 'doctor'],
    });
    if (!user) throw new AppException(ErrorCode.NOT_FOUND, { message: 'User not found.' });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, callerTenantId?: string | null): Promise<User> {
    const user = await this.findOne(id);
    if (user.type === UserType.SUPER_ADMIN && dto.type && dto.type !== UserType.SUPER_ADMIN) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'The SuperAdmin type cannot be changed.',
      });
    }
    // Tenant users cannot promote someone to super_admin.
    if (callerTenantId && dto.type === UserType.SUPER_ADMIN) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'You cannot assign the platform admin type.',
      });
    }
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      await this.assertEmailFree(dto.email);
    }
    const patch: Partial<User> = {
      name: dto.name ?? user.name,
      email: dto.email ? dto.email.toLowerCase() : user.email,
      type: dto.type ?? user.type,
      role_id: dto.role_id !== undefined ? dto.role_id : user.role_id,
      doctor_id: dto.doctor_id !== undefined ? dto.doctor_id : user.doctor_id,
      is_active: dto.is_active ?? user.is_active,
    };
    if (dto.password) {
      patch.password_hash = await bcrypt.hash(dto.password, 10);
    }
    await user.update(patch as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    if (user.type === UserType.SUPER_ADMIN) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'The SuperAdmin account cannot be deleted.',
      });
    }
    await user.destroy();
  }

  /** Loads a user with permissions for authentication (includes password hash). */
  async findForAuth(email: string): Promise<User | null> {
    return this.userModel.scope('withSecret').findOne({
      where: { email: email.toLowerCase() },
      include: [this.roleWithPerms, { model: Tenant }],
    });
  }

  /** Builds the request-scoped principal (fresh permissions) from a user id. */
  async buildAuthUser(id: string): Promise<AuthUser | null> {
    const user = await this.userModel.findByPk(id, {
      include: [this.roleWithPerms, { model: Tenant }],
    });
    if (!user || !user.is_active) return null;
    // Reject suspended tenants at the JWT-refresh layer too.
    const tenant = (user as any).tenant as Tenant | undefined;
    if (tenant && tenant.status === TenantStatus.SUSPENDED) return null;
    return UsersService.toAuthUser(user);
  }

  static toAuthUser(user: User): AuthUser {
    const permissions = (user.role?.permissions ?? []).map(
      (p) => `${p.module}:${p.action}`,
    );
    const tenant = (user as any).tenant as Tenant | undefined;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.type,
      tenantId: user.tenant_id,
      tenantStatus: tenant?.status ?? null,
      roleId: user.role_id,
      doctorId: user.doctor_id,
      permissions,
    };
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing = await this.userModel.findOne({
      where: { email: email.toLowerCase() },
      paranoid: false,
    });
    if (existing) {
      throw new AppException(ErrorCode.EMAIL_TAKEN);
    }
  }
}
