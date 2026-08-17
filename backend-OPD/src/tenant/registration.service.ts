import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Tenant, TenantStatus } from '../database/models/tenant.model';
import { Doctor } from '../database/models/doctor.model';
import { User } from '../database/models/user.model';
import { Role } from '../database/models/role.model';
import { Permission } from '../database/models/permission.model';
import { RolePermission } from '../database/models/role-permission.model';
import { RegisterDto } from '../auth/dto/register.dto';
import { ROLE_TEMPLATES } from './role-templates';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UserType } from '../common/enums';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Role) private readonly roleModel: typeof Role,
    @InjectModel(Permission) private readonly permissionModel: typeof Permission,
    @InjectModel(RolePermission) private readonly rolePermModel: typeof RolePermission,
    private readonly sequelize: Sequelize,
  ) {}

  async register(dto: RegisterDto): Promise<{ tenantId: string; userId: string }> {
    // Guard: unique email.
    const emailExists = await this.userModel.findOne({
      where: { email: dto.email.toLowerCase() },
      paranoid: false,
      crossTenant: true,
    } as any);
    if (emailExists) throw new AppException(ErrorCode.EMAIL_TAKEN);

    // Guard: unique tenant slug.
    const slug = await this.uniqueSlug(dto.clinic_name ?? `Dr. ${dto.doctor_name}`);

    const clinicName = dto.clinic_name?.trim() || `Dr. ${dto.doctor_name}'s Clinic`;
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.sequelize.transaction(async (t) => {
      const xopts: any = { transaction: t, crossTenant: true };

      // 1. Tenant
      const tenant = (await this.tenantModel.create({
        id: randomUUID(),
        name: clinicName,
        slug,
        status: TenantStatus.ACTIVE,
        timezone: 'Asia/Kolkata',
      } as any, xopts)) as Tenant;

      // 2. Seed role templates for this tenant
      const permCatalog = await this.permissionModel.findAll();
      const permByKey = new Map(
        permCatalog.map((p) => [`${p.module}:${p.action}`, p.id]),
      );

      const ownerRoleId = await this.seedRoles(tenant.id, permByKey, xopts);

      // 3. Doctor row (not yet enabled)
      const publicSlug = await this.uniqueDoctorSlug(dto.doctor_name);
      const doctor = (await this.doctorModel.create({
        name: dto.doctor_name,
        specialization: dto.specialization ?? null,
        public_slug: publicSlug,
        is_enabled: false,
        tenant_id: tenant.id,
      } as any, xopts)) as Doctor;

      // 4. Owner user
      const user = (await this.userModel.create({
        name: dto.doctor_name,
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        type: UserType.DOCTOR,
        tenant_id: tenant.id,
        role_id: ownerRoleId,
        doctor_id: doctor.id,
        is_active: true,
      } as any, xopts)) as User;

      // 5. Set owner_user_id on tenant
      await tenant.update({ owner_user_id: user.id } as any, xopts);

      return { tenantId: tenant.id, userId: user.id };
    });
  }

  private async seedRoles(
    tenantId: string,
    permByKey: Map<string, string>,
    xopts: any,
  ): Promise<string> {
    let ownerRoleId = '';
    for (const tmpl of ROLE_TEMPLATES) {
      const role = (await this.roleModel.create({
        name: tmpl.name,
        description: tmpl.description,
        is_system: tmpl.isSystem,
        tenant_id: tenantId,
      } as any, xopts)) as Role;

      if (tmpl.name === 'Owner') ownerRoleId = role.id;

      const permLinks = tmpl.grants
        .map((g) => permByKey.get(`${g.module}:${g.action}`))
        .filter(Boolean)
        .map((pid) => ({ role_id: role.id, permission_id: pid }));

      if (permLinks.length) {
        await this.rolePermModel.bulkCreate(permLinks as any, xopts);
      }
    }
    return ownerRoleId;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50) || 'clinic';
    let slug = base;
    let n = 1;
    while (
      await this.tenantModel.findOne({
        where: { slug },
        paranoid: false,
        crossTenant: true,
      } as any)
    ) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private async uniqueDoctorSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'doctor';
    let slug = base;
    let n = 1;
    while (
      await this.doctorModel.findOne({
        where: { public_slug: slug },
        paranoid: false,
        crossTenant: true,
      } as any)
    ) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }
}
