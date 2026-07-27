import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, UniqueConstraintError } from 'sequelize';
import { Appointment } from '../database/models/appointment.model';
import { Doctor } from '../database/models/doctor.model';
import { SlotsService } from '../slots/slots.service';
import { StorageService } from '../uploads/storage.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  ConsultationDto,
  ListAppointmentsQueryDto,
  PaymentReviewDto,
} from './dto/manage-appointment.dto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  AppointmentStatus,
  BookingSource,
  ConsultationStatus,
  PaymentStatus,
  UserType,
} from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    private readonly slots: SlotsService,
    private readonly storage: StorageService,
    private readonly sequelize: Sequelize,
  ) {}

  /** Guest booking (plan §6). Concurrency-safe via partial unique index. */
  async book(
    dto: CreateAppointmentDto,
    file: Express.Multer.File,
    source: BookingSource,
  ): Promise<Appointment> {
    const doctor = await this.doctorModel.findByPk(dto.doctor_id);
    if (!doctor || !doctor.is_enabled) {
      throw new AppException(ErrorCode.DOCTOR_DISABLED);
    }

    // Validate slot (window / past / leave / exists) → derive end_time.
    const { endTime } = await this.slots.assertBookableSlot(
      dto.doctor_id,
      dto.appointment_date,
      dto.start_time,
    );

    // Fail fast on an obviously-taken slot before spending an S3 upload.
    await this.assertSlotFree(dto.doctor_id, dto.appointment_date, dto.start_time);

    // Validate + upload screenshot first; only persist the row on success.
    this.storage.validateImage(file);
    const { key } = await this.storage.uploadImage(
      file,
      `appointments/${dto.doctor_id}`,
    );

    try {
      const appointment = await this.sequelize.transaction(async (t) => {
        return this.appointmentModel.create(
          {
            doctor_id: dto.doctor_id,
            appointment_date: dto.appointment_date,
            start_time: dto.start_time,
            end_time: endTime,
            patient_name: dto.patient_name,
            patient_mobile: dto.patient_mobile,
            patient_address: dto.patient_address ?? null,
            description: dto.description ?? null,
            payment_screenshot_url: key,
            status: AppointmentStatus.CONFIRMED,
            consultation_status: ConsultationStatus.PENDING,
            payment_status: PaymentStatus.PAID_UNVERIFIED,
            source,
          } as any,
          { transaction: t },
        );
      });
      return this.withDoctor(appointment.id);
    } catch (err) {
      // Roll back the orphaned upload on any failure.
      await this.storage.delete(key);
      if (err instanceof UniqueConstraintError) {
        throw new AppException(ErrorCode.SLOT_ALREADY_BOOKED);
      }
      throw err;
    }
  }

  async list(
    query: ListAppointmentsQueryDto,
    user: AuthUser,
  ): Promise<Appointment[]> {
    const where: any = {};
    // Data scope: a doctor only ever sees their own appointments.
    if (user.type === UserType.DOCTOR) {
      if (!user.doctorId) return [];
      where.doctor_id = user.doctorId;
    } else if (query.doctorId) {
      where.doctor_id = query.doctorId;
    }
    if (query.date) where.appointment_date = query.date;
    if (query.status) where.status = query.status;

    // Free-text search: match patient name or mobile (case-insensitive).
    const search = query.search?.trim();
    if (search) {
      const like = `%${search}%`;
      where[Op.or] = [
        { patient_name: { [Op.iLike]: like } },
        { patient_mobile: { [Op.iLike]: like } },
      ];
    }

    return this.appointmentModel.findAll({
      where,
      include: [{ model: Doctor, attributes: ['id', 'name', 'specialization'] }],
      order: [
        ['appointment_date', 'DESC'],
        ['start_time', 'ASC'],
      ],
    });
  }

  async findOne(id: string, user: AuthUser) {
    const appointment = await this.withDoctor(id);
    this.assertOwnership(appointment, user);
    const screenshotUrl = await this.storage.presignedGetUrl(
      appointment.payment_screenshot_url,
    );
    return { ...appointment.toJSON(), screenshot_url: screenshotUrl };
  }

  async setConsultation(
    id: string,
    dto: ConsultationDto,
    user: AuthUser,
  ): Promise<Appointment> {
    const appointment = await this.findRaw(id);
    this.assertOwnership(appointment, user);
    await appointment.update({ consultation_status: dto.status } as any);
    return this.withDoctor(id);
  }

  /** Payment review (#2). Rejecting frees a future slot via the partial index. */
  async setPayment(
    id: string,
    dto: PaymentReviewDto,
    user: AuthUser,
  ): Promise<Appointment> {
    const appointment = await this.findRaw(id);
    this.assertOwnership(appointment, user);

    if (dto.status === PaymentStatus.VERIFIED) {
      await appointment.update({ payment_status: PaymentStatus.VERIFIED } as any);
    } else {
      // Rejected screenshot → drop the booking; the slot returns to available
      // if still in the future (partial unique index no longer covers it).
      await appointment.update({
        payment_status: PaymentStatus.REJECTED,
        status: AppointmentStatus.REJECTED,
      } as any);
    }
    return this.withDoctor(id);
  }

  // ── helpers ────────────────────────────────────────────────

  private async assertSlotFree(
    doctorId: string,
    date: string,
    startTime: string,
  ): Promise<void> {
    const existing = await this.appointmentModel.findOne({
      where: {
        doctor_id: doctorId,
        appointment_date: date,
        start_time: startTime,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    if (existing) throw new AppException(ErrorCode.SLOT_ALREADY_BOOKED);
  }

  private async findRaw(id: string): Promise<Appointment> {
    const appointment = await this.appointmentModel.findByPk(id);
    if (!appointment) {
      throw new AppException(ErrorCode.NOT_FOUND, {
        message: 'Appointment not found.',
      });
    }
    return appointment;
  }

  private async withDoctor(id: string): Promise<Appointment> {
    return (await this.appointmentModel.findByPk(id, {
      include: [
        {
          model: Doctor,
          attributes: ['id', 'name', 'specialization', 'consultation_fee'],
        },
      ],
    })) as Appointment;
  }

  private assertOwnership(appointment: Appointment, user: AuthUser): void {
    if (
      user.type === UserType.DOCTOR &&
      appointment.doctor_id !== user.doctorId
    ) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        message: 'You can only access your own appointments.',
      });
    }
  }
}
