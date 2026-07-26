import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Appointment } from '../database/models/appointment.model';
import { Doctor } from '../database/models/doctor.model';
import { AppointmentStatus, UserType } from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { nowInClinic } from '../common/utils/clinic-time';

@Injectable()
export class DashboardService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
  ) {}

  async summary(user: AuthUser) {
    const today = nowInClinic(
      this.config.get<string>('clinicTimezone') ?? 'Asia/Kolkata',
    ).date;
    const scope: any = { appointment_date: today };
    if (user.type === UserType.DOCTOR) {
      if (!user.doctorId) return { date: today, total: 0, byDoctor: [], byStatus: {} };
      scope.doctor_id = user.doctorId;
    }

    const todays = await this.appointmentModel.findAll({
      where: scope,
      include: [{ model: Doctor, attributes: ['id', 'name'] }],
      order: [['start_time', 'ASC']],
    });

    const confirmed = todays.filter((a) => a.status === AppointmentStatus.CONFIRMED);

    const byDoctorMap = new Map<string, { doctorId: string; name: string; count: number }>();
    for (const a of confirmed) {
      const key = a.doctor_id;
      const entry = byDoctorMap.get(key) ?? {
        doctorId: key,
        name: (a as any).doctor?.name ?? 'Unknown',
        count: 0,
      };
      entry.count += 1;
      byDoctorMap.set(key, entry);
    }

    const byStatus = confirmed.reduce<Record<string, number>>((acc, a) => {
      acc[a.consultation_status] = (acc[a.consultation_status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      date: today,
      total: confirmed.length,
      byDoctor: [...byDoctorMap.values()],
      byStatus,
      appointments: confirmed,
    };
  }
}
