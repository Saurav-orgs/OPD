import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Doctor } from '../database/models/doctor.model';
import { Tenant, TenantStatus } from '../database/models/tenant.model';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
import { StorageService } from '../uploads/storage.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { getTenantContext } from '../tenant/tenant-context';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    private readonly storage: StorageService,
  ) {}

  // ── Tenant self-service ────────────────────────────────────

  /** /doctors/me — returns the doctor profile for the logged-in doctor. */
  async getOwn(user: AuthUser) {
    if (!user.doctorId) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'This account is not linked to a doctor profile.',
      });
    }
    return this.toView(await this.getOrFail(user.doctorId));
  }

  async updateOwn(user: AuthUser, dto: UpdateDoctorDto) {
    if (!user.doctorId) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'This account is not linked to a doctor profile.',
      });
    }
    const doctor = await this.getOrFail(user.doctorId);
    await doctor.update(dto as any);
    return this.toView(doctor);
  }

  async uploadQrOwn(user: AuthUser, file: Express.Multer.File) {
    if (!user.doctorId) throw new AppException(ErrorCode.FORBIDDEN);
    return this.uploadQr(user.doctorId, file);
  }

  async uploadPhotoOwn(user: AuthUser, file: Express.Multer.File) {
    if (!user.doctorId) throw new AppException(ErrorCode.FORBIDDEN);
    return this.uploadPhoto(user.doctorId, file);
  }

  // ── Platform admin only (cross-tenant) ────────────────────

  async create(dto: CreateDoctorDto) {
    const public_slug = await this.uniqueSlug(dto.name);
    const { tenantId } = getTenantContext();
    const doctor = await this.doctorModel.create({
      ...dto,
      public_slug,
      is_enabled: false,
      tenant_id: tenantId,
    } as any);
    return this.toView(doctor);
  }

  async findAll() {
    // Hook scopes by tenant_id automatically for tenant users.
    const doctors = await this.doctorModel.findAll({
      order: [['created_at', 'DESC']],
    });
    return doctors.map((d) => this.toView(d));
  }

  async findOne(id: string) {
    return this.toView(await this.getOrFail(id));
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const doctor = await this.getOrFail(id);
    await doctor.update(dto as any);
    return this.toView(doctor);
  }

  async remove(id: string): Promise<void> {
    const doctor = await this.getOrFail(id);
    await doctor.destroy();
  }

  async setEnabled(id: string, enabled: boolean) {
    const doctor = await this.getOrFail(id);
    await doctor.update({ is_enabled: enabled } as any);
    return this.toView(doctor);
  }

  async uploadQr(id: string, file: Express.Multer.File) {
    const doctor = await this.getOrFail(id);
    const { key } = await this.storage.uploadImage(
      file,
      `tenants/${doctor.tenant_id}/doctors/${id}/qr`,
    );
    if (doctor.payment_qr_url) await this.storage.delete(doctor.payment_qr_url);
    await doctor.update({ payment_qr_url: key } as any);
    return this.toView(doctor);
  }

  async uploadPhoto(id: string, file: Express.Multer.File) {
    const doctor = await this.getOrFail(id);
    const { key } = await this.storage.uploadImage(
      file,
      `tenants/${doctor.tenant_id}/doctors/${id}/photo`,
    );
    if (doctor.profile_photo_url) await this.storage.delete(doctor.profile_photo_url);
    await doctor.update({ profile_photo_url: key } as any);
    return this.toView(doctor);
  }

  /** Raw model fetch — scoped via hook for tenant users. */
  private async getOrFail(id: string): Promise<Doctor> {
    const doctor = await this.doctorModel.findByPk(id);
    if (!doctor)
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Doctor not found.' });
    return doctor;
  }

  /** Admin/self projection — resolves image keys to loadable URLs. */
  private toView(d: Doctor) {
    const json = d.toJSON() as any;
    return {
      ...json,
      profile_photo_url: this.storage.publicUrl(d.profile_photo_url),
      payment_qr_url: this.storage.publicUrl(d.payment_qr_url),
    };
  }

  // ── Public (patient app) ───────────────────────────────────

  /** Lists enabled doctors from active tenants only. */
  async listEnabled(): Promise<any[]> {
    const doctors = await this.doctorModel.findAll({
      where: { is_enabled: true },
      include: [{ model: Tenant, where: { status: TenantStatus.ACTIVE }, attributes: ['id', 'name', 'slug', 'logo_url', 'address'] }],
      order: [['name', 'ASC']],
      crossTenant: true,
    } as any);
    return doctors.map((d) => this.toPublic(d));
  }

  async findEnabledBySlug(slug: string): Promise<any> {
    const doctor = await this.doctorModel.findOne({
      where: { public_slug: slug, is_enabled: true },
      include: [{ model: Tenant, where: { status: TenantStatus.ACTIVE }, attributes: ['id', 'name', 'slug', 'logo_url', 'address', 'contact_phone'] }],
      crossTenant: true,
    } as any);
    if (!doctor) throw new AppException(ErrorCode.DOCTOR_DISABLED);
    return this.toPublic(doctor);
  }

  async findEnabledById(id: string): Promise<Doctor> {
    const doctor = await this.doctorModel.findOne({
      where: { id, is_enabled: true },
      include: [{ model: Tenant, where: { status: TenantStatus.ACTIVE } }],
      crossTenant: true,
    } as any);
    if (!doctor) throw new AppException(ErrorCode.DOCTOR_DISABLED);
    return doctor;
  }

  /** Public-safe projection with resolved image URLs. */
  toPublic(d: Doctor) {
    const tenant = (d as any).tenant as Tenant | undefined;
    return {
      id: d.id,
      name: d.name,
      specialization: d.specialization,
      qualifications: d.qualifications,
      bio: d.bio,
      consultation_fee: d.consultation_fee,
      public_slug: d.public_slug,
      profile_photo_url: this.storage.publicUrl(d.profile_photo_url),
      payment_qr_url: this.storage.publicUrl(d.payment_qr_url),
      clinic: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            logo_url: this.storage.publicUrl(tenant.logo_url),
            address: tenant.address,
            contact_phone: (tenant as any).contact_phone ?? null,
          }
        : null,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
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
