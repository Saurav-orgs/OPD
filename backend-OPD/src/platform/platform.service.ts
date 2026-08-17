import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Tenant, TenantStatus } from '../database/models/tenant.model';
import { User } from '../database/models/user.model';
import { Doctor } from '../database/models/doctor.model';
import { Appointment } from '../database/models/appointment.model';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class PlatformService {
  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
  ) {}

  listTenants(): Promise<Tenant[]> {
    return this.tenantModel.findAll({
      order: [['created_at', 'DESC']],
      crossTenant: true,
    } as any);
  }

  async getTenant(id: string): Promise<any> {
    const tenant = await this.tenantModel.findByPk(id, { crossTenant: true } as any);
    if (!tenant) throw new AppException(ErrorCode.TENANT_NOT_FOUND);

    const [userCount, doctorCount, appointmentCount] = await Promise.all([
      this.userModel.count({ where: { tenant_id: id }, crossTenant: true } as any),
      this.doctorModel.count({ where: { tenant_id: id }, crossTenant: true } as any),
      this.appointmentModel.count({ where: { tenant_id: id }, crossTenant: true } as any),
    ]);

    return { ...tenant.toJSON(), stats: { userCount, doctorCount, appointmentCount } };
  }

  async suspend(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findByPk(id, { crossTenant: true } as any);
    if (!tenant) throw new AppException(ErrorCode.TENANT_NOT_FOUND);
    await tenant.update({ status: TenantStatus.SUSPENDED } as any);
    return tenant;
  }

  async reactivate(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findByPk(id, { crossTenant: true } as any);
    if (!tenant) throw new AppException(ErrorCode.TENANT_NOT_FOUND);
    await tenant.update({ status: TenantStatus.ACTIVE } as any);
    return tenant;
  }

  async platformStats(): Promise<any> {
    const [totalTenants, activeTenants, totalAppointments] = await Promise.all([
      this.tenantModel.count({ crossTenant: true } as any),
      this.tenantModel.count({
        where: { status: TenantStatus.ACTIVE },
        crossTenant: true,
      } as any),
      this.appointmentModel.count({ crossTenant: true } as any),
    ]);
    return { totalTenants, activeTenants, totalAppointments };
  }
}
