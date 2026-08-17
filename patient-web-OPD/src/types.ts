export interface Clinic {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  address?: string | null;
  contactPhone?: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialization?: string | null;
  qualifications?: string | null;
  bio?: string | null;
  consultationFee?: string | null;
  consultation_fee?: string | number | null;
  profilePhotoUrl?: string | null;
  profile_photo_url?: string | null;
  paymentQrUrl?: string | null;
  payment_qr_url?: string | null;
  publicSlug: string;
  public_slug?: string | null;
  /** Which practice this doctor belongs to (multi-tenant). */
  clinic?: Clinic | null;
}

export type Gender = 'male' | 'female' | 'other';

export interface Patient {
  id: string;
  mobile: string;
  name: string;
  age: number | null;
  gender: Gender | null;
}

export interface PatientReport {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string | null;
  viewUrl: string | null;
}

export interface PatientAppointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  consultationStatus: string;
  paymentStatus: string;
  description?: string | null;
  doctorNotes?: string | null;
  doctor: { id: string; name: string; specialization?: string | null; publicSlug?: string } | null;
  clinic: { id: string; name: string; slug: string } | null;
  reports?: PatientReport[];
}

export type SlotStatus = 'available' | 'booked' | 'past';

export interface Slot {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: SlotStatus;
  selectable: boolean;
}

export interface DaySlots {
  date: string; // YYYY-MM-DD
  available: boolean;
  reason?: 'leave' | 'no_opd' | 'out_of_window' | string | null;
  slots: Slot[];
}

export interface BookingResult {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  patientName: string;
  doctorName?: string | null;
}

export class ApiException extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(code: string, message: string, statusCode: number, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiException';
  }
}
