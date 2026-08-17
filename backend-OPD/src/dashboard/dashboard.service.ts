import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Appointment } from '../database/models/appointment.model';
import { Doctor } from '../database/models/doctor.model';
import { AppointmentStatus } from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { getTenantContext } from '../tenant/tenant-context';
import { nowInClinic } from '../common/utils/clinic-time';
import { InjectModel as InjectM } from '@nestjs/sequelize';
import { Tenant } from '../database/models/tenant.model';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
  ) {}

  async summary(user: AuthUser) {
    // Resolve timezone from tenant row (falls back to Kolkata for platform admins).
    let tz = 'Asia/Kolkata';
    if (user.tenantId) {
      const tenant = await this.tenantModel.findByPk(user.tenantId);
      if (tenant) tz = tenant.timezone;
    }

    const today = nowInClinic(tz).date;

    // The Sequelize hook automatically scopes by tenant_id for tenant users.
    const todays = await this.appointmentModel.findAll({
      where: { appointment_date: today },
      include: [{ model: Doctor, attributes: ['id', 'name'] }],
      order: [['start_time', 'ASC']],
    });

    const confirmed = todays.filter((a) => a.status === AppointmentStatus.CONFIRMED);

    const byStatus = confirmed.reduce<Record<string, number>>((acc, a) => {
      acc[a.consultation_status] = (acc[a.consultation_status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      date: today,
      total: confirmed.length,
      byStatus,
      appointments: confirmed,
    };
  }
}
