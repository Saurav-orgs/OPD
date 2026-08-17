import axios, { AxiosError } from 'axios';
import { AppConfig } from './config';
import type {
  Doctor,
  DaySlots,
  BookingResult,
  Patient,
  PatientAppointment,
  PatientReport,
  Clinic,
} from './types';
import { ApiException } from './types';

const TOKEN_KEY = 'opd_patient_token';

export const patientToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const client = axios.create({
  baseURL: AppConfig.apiBaseUrl,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = patientToken.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function mapClinic(c: any): Clinic | null {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    address: c.address ?? null,
    contactPhone: c.contact_phone ?? null,
  };
}

function mapDoctor(d: any): Doctor {
  return {
    id: d.id,
    name: d.name,
    specialization: d.specialization,
    qualifications: d.qualifications,
    bio: d.bio,
    consultationFee: d.consultation_fee != null ? String(d.consultation_fee) : null,
    profilePhotoUrl: d.profile_photo_url,
    paymentQrUrl: d.payment_qr_url,
    publicSlug: d.public_slug || '',
    clinic: mapClinic(d.clinic),
  };
}

function mapReport(r: any): PatientReport {
  return {
    id: r.id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes ?? 0,
    createdAt: r.created_at ?? null,
    viewUrl: r.view_url ?? null,
  };
}

function mapAppointment(a: any): PatientAppointment {
  return {
    id: a.id,
    appointmentDate: a.appointment_date,
    startTime: (a.start_time || '').slice(0, 5),
    endTime: (a.end_time || '').slice(0, 5),
    status: a.status,
    consultationStatus: a.consultation_status,
    paymentStatus: a.payment_status,
    description: a.description,
    doctorNotes: a.doctor_notes,
    doctor: a.doctor
      ? {
          id: a.doctor.id,
          name: a.doctor.name,
          specialization: a.doctor.specialization,
          publicSlug: a.doctor.public_slug,
        }
      : null,
    clinic: a.clinic ?? null,
    reports: (a.reports || []).map(mapReport),
  };
}

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const error = err as AxiosError<any>;
    if (!error.response) {
      throw new ApiException(
        'NETWORK_ERROR',
        'Unable to reach the server. Check your connection.',
        0
      );
    }
    const data = error.response.data;
    if (data && typeof data === 'object') {
      throw new ApiException(
        data.error || 'ERROR',
        data.message || 'Something went wrong. Please try again.',
        error.response.status,
        data.details
      );
    }
    throw new ApiException('ERROR', 'Something went wrong.', error.response.status);
  }
  throw new ApiException('ERROR', 'Unexpected error occurred.', 0);
}

export const api = {
  async listDoctors(): Promise<Doctor[]> {
    try {
      const res = await client.get('/public/doctors');
      const rawList = res.data.data ?? res.data;
      return rawList.map(mapDoctor);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async doctorByIdOrSlug(idOrSlug: string): Promise<Doctor> {
    try {
      const res = await client.get(`/public/doctors/${idOrSlug}`);
      return mapDoctor(res.data.data ?? res.data);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  // ── Patient auth (OTP) ──────────────────────────────────────
  async requestOtp(mobile: string): Promise<{ expiresInSeconds: number }> {
    try {
      const res = await client.post('/patient/auth/request-otp', { mobile });
      const d = res.data.data ?? res.data;
      return { expiresInSeconds: d.expiresInSeconds ?? 300 };
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async verifyOtp(
    mobile: string,
    code: string
  ): Promise<{ accessToken: string; patient: Patient | null; isNew: boolean }> {
    try {
      const res = await client.post('/patient/auth/verify-otp', { mobile, code });
      const d = res.data.data ?? res.data;
      return { accessToken: d.accessToken, patient: d.patient, isNew: d.isNew };
    } catch (err) {
      handleAxiosError(err);
    }
  },

  // ── Patient self-service ────────────────────────────────────
  async me(): Promise<{ mobile: string; registered: boolean; patient: Patient | null }> {
    try {
      const res = await client.get('/patient/me');
      return res.data.data ?? res.data;
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async updateMe(body: {
    name?: string;
    age?: number;
    gender?: string;
  }): Promise<Patient> {
    try {
      const res = await client.patch('/patient/me', body);
      return res.data.data ?? res.data;
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async myAppointments(): Promise<PatientAppointment[]> {
    try {
      const res = await client.get('/patient/appointments');
      return (res.data.data ?? res.data).map(mapAppointment);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async myAppointment(id: string): Promise<PatientAppointment> {
    try {
      const res = await client.get(`/patient/appointments/${id}`);
      return mapAppointment(res.data.data ?? res.data);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async uploadReport(appointmentId: string, file: File): Promise<PatientReport> {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await client.post(
        `/patient/appointments/${appointmentId}/reports`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return mapReport(res.data.data ?? res.data);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async deleteReport(reportId: string): Promise<void> {
    try {
      await client.delete(`/patient/reports/${reportId}`);
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async getSlots(doctorId: string, date: string): Promise<DaySlots> {
    try {
      const res = await client.get(`/public/doctors/${doctorId}/slots`, {
        params: { date },
      });
      const data = res.data.data ?? res.data;
      return {
        date: data.date,
        available: data.available ?? false,
        reason: data.reason,
        slots: (data.slots || []).map((s: any) => ({
          startTime: s.start_time,
          endTime: s.end_time,
          status: s.status === 'booked' ? 'booked' : s.status === 'past' ? 'past' : 'available',
          selectable: s.status === 'available' || s.status === undefined,
        })),
      };
    } catch (err) {
      handleAxiosError(err);
    }
  },

  async bookAppointment(params: {
    doctorId: string;
    date: string;
    startTime: string;
    patientName: string;
    patientMobile: string;
    patientAddress?: string;
    description?: string;
    screenshot: File;
  }): Promise<BookingResult> {
    try {
      const formData = new FormData();
      formData.append('doctor_id', params.doctorId);
      formData.append('appointment_date', params.date);
      formData.append('start_time', params.startTime);
      formData.append('patient_name', params.patientName);
      formData.append('patient_mobile', params.patientMobile);
      if (params.patientAddress?.trim()) {
        formData.append('patient_address', params.patientAddress.trim());
      }
      if (params.description?.trim()) {
        formData.append('description', params.description.trim());
      }
      formData.append('screenshot', params.screenshot);

      const res = await client.post('/public/appointments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = res.data.data ?? res.data;
      return {
        id: data.id,
        appointmentDate: data.appointment_date,
        startTime: (data.start_time || '').slice(0, 5),
        endTime: (data.end_time || '').slice(0, 5),
        patientName: data.patient_name,
        doctorName: data.doctor?.name || null,
      };
    } catch (err) {
      handleAxiosError(err);
    }
  },
};
