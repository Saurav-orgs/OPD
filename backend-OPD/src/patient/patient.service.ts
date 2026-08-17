import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Patient } from '../database/models/patient.model';
import { Appointment } from '../database/models/appointment.model';
import { PatientReport } from '../database/models/patient-report.model';
import { Doctor } from '../database/models/doctor.model';
import { Tenant } from '../database/models/tenant.model';
import { StorageService } from '../uploads/storage.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientPrincipal } from './current-patient.decorator';

/**
 * Patient self-service. Every read here is deliberately CROSS-TENANT and
 * narrowed by patient_id instead: a patient's own history spans every clinic
 * they have visited, which is exactly what tenant scoping would otherwise hide.
 */
@Injectable()
export class PatientService {
  constructor(
    @InjectModel(Patient) private readonly patientModel: typeof Patient,
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(PatientReport) private readonly reportModel: typeof PatientReport,
    private readonly storage: StorageService,
  ) {}

  /** Registration state + profile. Never 404s — the client needs both cases. */
  me(principal: PatientPrincipal) {
    return {
      mobile: principal.mobile,
      registered: Boolean(principal.patient),
      patient: principal.patient ? this.toPublic(principal.patient) : null,
    };
  }

  /** Creates the patient row on first call, updates it thereafter. */
  async updateMe(principal: PatientPrincipal, dto: UpdatePatientDto) {
    let patient = principal.patient;

    if (!patient) {
      if (!dto.name?.trim()) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          message: 'Your name is required to complete registration.',
        });
      }
      patient = (await this.patientModel.create({
        mobile: principal.mobile,
        name: dto.name.trim(),
        age: dto.age ?? null,
        gender: dto.gender ?? null,
      } as any)) as Patient;
      return this.toPublic(patient);
    }

    await patient.update({
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.age !== undefined ? { age: dto.age } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
    } as any);
    return this.toPublic(patient);
  }

  async listAppointments(principal: PatientPrincipal) {
    const patient = this.requirePatient(principal);
    const rows = await this.appointmentModel.findAll({
      where: { patient_id: patient.id },
      include: [
        { model: Doctor, attributes: ['id', 'name', 'specialization', 'public_slug'] },
        { model: Tenant, attributes: ['id', 'name', 'slug'] },
      ],
      order: [
        ['appointment_date', 'DESC'],
        ['start_time', 'DESC'],
      ],
      crossTenant: true,
    } as any);
    return rows.map((a) => this.appointmentPublic(a));
  }

  async getAppointment(principal: PatientPrincipal, id: string) {
    const patient = this.requirePatient(principal);
    const appt = (await this.appointmentModel.findOne({
      where: { id, patient_id: patient.id },
      include: [
        { model: Doctor, attributes: ['id', 'name', 'specialization', 'public_slug'] },
        { model: Tenant, attributes: ['id', 'name', 'slug'] },
      ],
      crossTenant: true,
    } as any)) as Appointment | null;
    if (!appt) throw new AppException(ErrorCode.NOT_FOUND);

    return {
      ...this.appointmentPublic(appt),
      reports: await this.reportsFor(appt.id),
    };
  }

  async uploadReport(
    principal: PatientPrincipal,
    appointmentId: string,
    file: Express.Multer.File,
  ) {
    const patient = this.requirePatient(principal);
    const appt = (await this.appointmentModel.findOne({
      where: { id: appointmentId, patient_id: patient.id },
      crossTenant: true,
    } as any)) as Appointment | null;
    if (!appt) throw new AppException(ErrorCode.NOT_FOUND);

    const stored = await this.storage.uploadDocument(
      file,
      `tenants/${appt.tenant_id}/patients/${patient.id}/reports`,
    );

    const report = (await this.reportModel.create(
      {
        tenant_id: appt.tenant_id,
        appointment_id: appt.id,
        patient_id: patient.id,
        file_key: stored.key,
        file_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
      } as any,
      { crossTenant: true } as any,
    )) as PatientReport;

    return this.reportPublic(report, await this.storage.presignedGetUrl(report.file_key));
  }

  async deleteReport(principal: PatientPrincipal, reportId: string) {
    const patient = this.requirePatient(principal);
    const report = (await this.reportModel.findOne({
      where: { id: reportId, patient_id: patient.id },
      crossTenant: true,
    } as any)) as PatientReport | null;
    if (!report) throw new AppException(ErrorCode.NOT_FOUND);

    await this.storage.delete(report.file_key);
    await report.destroy();
    return { deleted: true };
  }

  /** Reports for one appointment, each with a short-lived view URL. */
  async reportsFor(appointmentId: string) {
    const rows = (await this.reportModel.findAll({
      where: { appointment_id: appointmentId },
      order: [['created_at', 'ASC']],
      crossTenant: true,
    } as any)) as PatientReport[];

    return Promise.all(
      rows.map(async (r) =>
        this.reportPublic(r, await this.storage.presignedGetUrl(r.file_key)),
      ),
    );
  }

  findById(id: string): Promise<Patient | null> {
    return this.patientModel.findByPk(id) as Promise<Patient | null>;
  }

  /** Find-or-create used by the booking flow so every booking has an identity. */
  async resolveOrCreate(
    mobile: string,
    name: string,
    transaction?: any,
  ): Promise<Patient> {
    const existing = (await this.patientModel.findOne({
      where: { mobile },
      transaction,
    })) as Patient | null;
    if (existing) return existing;

    return (await this.patientModel.create(
      { mobile, name } as any,
      { transaction } as any,
    )) as Patient;
  }

  private requirePatient(principal: PatientPrincipal): Patient {
    if (!principal.patient) throw new AppException(ErrorCode.PROFILE_INCOMPLETE);
    return principal.patient;
  }

  private toPublic(p: Patient) {
    return {
      id: p.id,
      mobile: p.mobile,
      name: p.name,
      age: p.age,
      gender: p.gender,
    };
  }

  private reportPublic(r: PatientReport, viewUrl: string | null) {
    return {
      id: r.id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      size_bytes: Number(r.size_bytes),
      created_at: (r as any).createdAt ?? null,
      view_url: viewUrl,
    };
  }

  private appointmentPublic(a: Appointment) {
    return {
      id: a.id,
      appointment_date: a.appointment_date,
      start_time: (a.start_time ?? '').slice(0, 5),
      end_time: (a.end_time ?? '').slice(0, 5),
      status: a.status,
      consultation_status: a.consultation_status,
      payment_status: a.payment_status,
      description: a.description,
      doctor_notes: a.doctor_notes,
      doctor: a.doctor
        ? {
            id: a.doctor.id,
            name: a.doctor.name,
            specialization: a.doctor.specialization,
            public_slug: a.doctor.public_slug,
          }
        : null,
      clinic: a.tenant ? { id: a.tenant.id, name: a.tenant.name, slug: a.tenant.slug } : null,
    };
  }
}
