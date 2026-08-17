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
  AppointmentNotesDto,
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
} from '../common/enums';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PatientService } from '../patient/patient.service';
import { normalizeMobile } from '../patient/mobile.util';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(Doctor) private readonly doctorModel: typeof Doctor,
    private readonly slots: SlotsService,
    private readonly storage: StorageService,
    private readonly patients: PatientService,
    private readonly sequelize: Sequelize,
  ) {}

  /** Guest booking (plan §6). Concurrency-safe via partial unique index. */
  async book(
    dto: CreateAppointmentDto,
    file: Express.Multer.File,
    source: BookingSource,
  ): Promise<Appointment> {
    const doctor = await this.doctorModel.findByPk(dto.doctor_id, { crossTenant: true } as any);
    if (!doctor || !doctor.is_enabled) {
      throw new AppException(ErrorCode.DOCTOR_DISABLED);
    }

    const { endTime } = await this.slots.assertBookableSlot(
      dto.doctor_id,
      dto.appointment_date,
      dto.start_time,
    );

    await this.assertSlotFree(dto.doctor_id, dto.appointment_date, dto.start_time);

    this.storage.validateImage(file);
    const { key } = await this.storage.uploadImage(
      file,
      `appointments/${dto.doctor_id}`,
    );

    // Every booking resolves to one global patient identity, keyed by the
    // normalised mobile, so the patient can later find this visit from any
    // clinic they have used.
    const mobile = normalizeMobile(dto.patient_mobile);

    try {
      const appointment = (await this.sequelize.transaction(async (t) => {
        const patient = await this.patients.resolveOrCreate(
          mobile,
          dto.patient_name,
          t,
        );
        return this.appointmentModel.create(
          {
            tenant_id: doctor.tenant_id,
            doctor_id: dto.doctor_id,
            patient_id: patient.id,
            appointment_date: dto.appointment_date,
            start_time: dto.start_time,
            end_time: endTime,
            patient_name: dto.patient_name,
            patient_mobile: mobile,
            patient_address: dto.patient_address ?? null,
            description: dto.description ?? null,
            payment_screenshot_url: key,
            status: AppointmentStatus.CONFIRMED,
            consultation_status: ConsultationStatus.PENDING,
            payment_status: PaymentStatus.PAID_UNVERIFIED,
            source,
          } as any,
          { transaction: t, crossTenant: true } as any,
        );
      })) as Appointment;
      return this.withDoctor(appointment.id);
    } catch (err) {
      await this.storage.delete(key);
      if (err instanceof UniqueConstraintError) {
        throw new AppException(ErrorCode.SLOT_ALREADY_BOOKED);
      }
      throw err;
    }
  }

  /**
   * List appointments scoped by the caller's tenant (injected via Sequelize hooks).
   * The doctor's own view is the same as the tenant view — one doctor per tenant.
   */
  async list(
    query: ListAppointmentsQueryDto,
    user: AuthUser,
  ): Promise<Appointment[]> {
    const where: any = {};
    if (query.date) where.appointment_date = query.date;
    if (query.status) where.status = query.status;

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
    // withDoctor() is tenant-scoped, so reaching this point already proves the
    // appointment belongs to the caller's clinic.
    const appointment = await this.withDoctor(id);
    const [screenshotUrl, reports, patient] = await Promise.all([
      this.storage.presignedGetUrl(appointment.payment_screenshot_url),
      this.patients.reportsFor(appointment.id),
      appointment.patient_id
        ? this.patients.findById(appointment.patient_id)
        : Promise.resolve(null),
    ]);

    return {
      ...appointment.toJSON(),
      screenshot_url: screenshotUrl,
      // Registered demographics, so the doctor sees age/gender alongside the
      // name captured at booking time.
      patient_age: patient?.age ?? null,
      patient_gender: patient?.gender ?? null,
      reports,
    };
  }

  async setConsultation(
    id: string,
    dto: ConsultationDto,
    user: AuthUser,
  ): Promise<Appointment> {
    const appointment = await this.findRaw(id);
    await appointment.update({ consultation_status: dto.status } as any);
    return this.withDoctor(id);
  }

  async setPayment(
    id: string,
    dto: PaymentReviewDto,
    user: AuthUser,
  ): Promise<Appointment> {
    const appointment = await this.findRaw(id);

    if (dto.status === PaymentStatus.VERIFIED) {
      await appointment.update({ payment_status: PaymentStatus.VERIFIED } as any);
    } else {
      await appointment.update({
        payment_status: PaymentStatus.REJECTED,
        status: AppointmentStatus.REJECTED,
      } as any);
    }
    return this.withDoctor(id);
  }

  async setNotes(
    id: string,
    dto: AppointmentNotesDto,
    user: AuthUser,
  ): Promise<Appointment> {
    const appointment = await this.findRaw(id);
    const notes = dto.notes.trim();
    await appointment.update({ doctor_notes: notes || null } as any);
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
      crossTenant: true,
    } as any);
    if (existing) throw new AppException(ErrorCode.SLOT_ALREADY_BOOKED);
  }

  private async findRaw(id: string): Promise<Appointment> {
    const appointment = await this.appointmentModel.findByPk(id);
    if (!appointment) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Appointment not found.' });
    }
    return appointment;
  }

  private async withDoctor(id: string): Promise<Appointment> {
    // The tenant hooks scope this query, so an appointment belonging to another
    // clinic simply comes back null — which must read as "not found", not crash.
    const appointment = (await this.appointmentModel.findByPk(id, {
      include: [
        {
          model: Doctor,
          attributes: ['id', 'name', 'specialization', 'consultation_fee'],
        },
      ],
    })) as Appointment | null;
    if (!appointment) {
      throw new AppException(ErrorCode.NOT_FOUND, {
        message: 'Appointment not found.',
      });
    }
    return appointment;
  }
}
