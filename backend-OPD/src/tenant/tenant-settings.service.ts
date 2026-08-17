import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Tenant } from '../database/models/tenant.model';
import { Doctor } from '../database/models/doctor.model';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { StorageService } from '../uploads/storage.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { AuthUser } from '../common/decorators/current-user.decorator';

export interface OnboardingChecklist {
  profile: boolean;
  photo: boolean;
  consultation_fee: boolean;
  payment_qr: boolean;
  schedule: boolean;
  complete: boolean;
}

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    private readonly storage: StorageService,
  ) {}

  async get(user: AuthUser): Promise<Tenant> {
    return this.getOrFail(user.tenantId!);
  }

  async update(user: AuthUser, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.getOrFail(user.tenantId!);
    await tenant.update(dto as any);
    return tenant;
  }

  async uploadLogo(user: AuthUser, file: Express.Multer.File): Promise<Tenant> {
    const tenant = await this.getOrFail(user.tenantId!);
    this.storage.validateImage(file);
    const { key } = await this.storage.uploadImage(file, `tenants/${tenant.id}/logo`);
    if (tenant.logo_url) await this.storage.delete(tenant.logo_url);
    await tenant.update({ logo_url: key } as any);
    return this.toView(tenant);
  }

  async onboarding(user: AuthUser): Promise<OnboardingChecklist> {
    const doctor = await this.doctorModel.findOne({
      where: { tenant_id: user.tenantId },
      crossTenant: true,
    } as any);

    if (!doctor) {
      return {
        profile: false,
        photo: false,
        consultation_fee: false,
        payment_qr: false,
        schedule: false,
        complete: false,
      };
    }

    const profile = !!(doctor.specialization || doctor.bio);
    const photo = !!doctor.profile_photo_url;
    const consultation_fee = !!doctor.consultation_fee;
    const payment_qr = !!doctor.payment_qr_url;

    const { OpdSchedule } = await import('../database/models/opd-schedule.model');
    const scheduleCount = await OpdSchedule.count({
      where: { doctor_id: doctor.id, is_active: true },
      crossTenant: true,
    } as any) as unknown as number;
    const schedule = scheduleCount > 0;

    const complete = profile && payment_qr && schedule;
    return { profile, photo, consultation_fee, payment_qr, schedule, complete };
  }

  async getBySlug(slug: string): Promise<any> {
    const tenant = await this.tenantModel.findOne({
      where: { slug },
      crossTenant: true,
    } as any);
    if (!tenant) throw new AppException(ErrorCode.TENANT_NOT_FOUND);
    const doctors = await this.doctorModel.findAll({
      where: { tenant_id: tenant.id, is_enabled: true },
      crossTenant: true,
    } as any);
    return {
      ...this.toView(tenant),
      doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization, public_slug: d.public_slug })),
    };
  }

  async goLive(user: AuthUser): Promise<{ success: boolean }> {
    const checklist = await this.onboarding(user);
    if (!checklist.payment_qr || !checklist.schedule) {
      throw new AppException(ErrorCode.ONBOARDING_INCOMPLETE, {
        message: 'Please add a payment QR and at least one schedule day before going live.',
      });
    }

    await this.doctorModel.update(
      { is_enabled: true } as any,
      { where: { tenant_id: user.tenantId }, crossTenant: true } as any,
    );

    return { success: true };
  }

  private async getOrFail(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findByPk(tenantId);
    if (!tenant) throw new AppException(ErrorCode.TENANT_NOT_FOUND);
    return tenant;
  }

  private toView(tenant: Tenant) {
    const json = tenant.toJSON() as any;
    return {
      ...json,
      logo_url: this.storage.publicUrl(tenant.logo_url),
    };
  }
}
