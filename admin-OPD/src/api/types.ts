export type UserType = 'super_admin' | 'admin' | 'doctor';
export type PermModule =
  | 'users'
  | 'roles'
  | 'doctors'
  | 'opd_schedules'
  | 'appointments'
  | 'dashboard'
  | 'tenant'
  | 'platform';
export type PermAction = 'create' | 'read' | 'update' | 'delete';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  type: UserType;
  tenantId: string | null;
  tenantStatus: 'active' | 'suspended' | null;
  roleId: string | null;
  doctorId: string | null;
  permissions: string[]; // "module:action"
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  logo_url: string | null;
  timezone: string;
  status: 'active' | 'suspended';
  owner_user_id: string | null;
}

export interface OnboardingChecklist {
  profile: boolean;
  photo: boolean;
  consultation_fee: boolean;
  payment_qr: boolean;
  schedule: boolean;
  complete: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  module: PermModule;
  action: PermAction;
}

export interface User {
  id: string;
  name: string;
  email: string;
  type: UserType;
  role_id: string | null;
  doctor_id: string | null;
  is_active: boolean;
  role?: Role;
  doctor?: Doctor;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string | null;
  qualifications: string | null;
  bio: string | null;
  consultation_fee: string | null;
  profile_photo_url: string | null;
  payment_qr_url: string | null;
  public_slug: string;
  is_enabled: boolean;
}

export interface ScheduleEntry {
  id?: string;
  day_of_week: number;
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;
  slot_duration_min: number;
  is_active?: boolean;
}

export type SlotStatus = 'available' | 'booked' | 'past';
export interface Slot {
  start_time: string;
  end_time: string;
  status: SlotStatus;
}
export interface DaySlots {
  date: string;
  available: boolean;
  reason?: 'leave' | 'no_opd' | 'out_of_window';
  slots: Slot[];
}

export type AppointmentStatus = 'confirmed' | 'rejected';
export type ConsultationStatus = 'pending' | 'done' | 'on_hold' | 'rejected';
export type PaymentStatus = 'paid_unverified' | 'verified' | 'rejected';

export interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  patient_name: string;
  patient_mobile: string;
  patient_address: string | null;
  description: string | null;
  doctor_notes: string | null;
  payment_screenshot_url: string;
  status: AppointmentStatus;
  consultation_status: ConsultationStatus;
  payment_status: PaymentStatus;
  source: 'app' | 'web';
  createdAt?: string;
  doctor?: Pick<Doctor, 'id' | 'name' | 'specialization' | 'consultation_fee'>;
  screenshot_url?: string;
  /** Registered demographics from the patient registry. */
  patient_age?: number | null;
  patient_gender?: string | null;
  reports?: PatientReport[];
}

export interface PatientReport {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string | null;
  view_url: string | null;
}

export interface BookingQr {
  url: string;
  qr_data_url: string;
  share_text: string;
}

export interface DashboardSummary {
  date: string;
  total: number;
  byStatus: Record<string, number>;
  appointments: Appointment[];
}

export interface PlatformTenant extends Tenant {
  stats?: { userCount: number; doctorCount: number; appointmentCount: number };
}
