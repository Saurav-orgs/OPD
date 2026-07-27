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
