/** Principal type — decides DATA SCOPE only, never abilities (plan §2). */
export enum UserType {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
}

/** Modules that permissions and the web sidebar are organised around. */
export enum PermissionModule {
  USERS = 'users',
  ROLES = 'roles',
  DOCTORS = 'doctors',
  OPD_SCHEDULES = 'opd_schedules',
  APPOINTMENTS = 'appointments',
  DASHBOARD = 'dashboard',
  TENANT = 'tenant',
  PLATFORM = 'platform',
}

/** CRUD actions a role may be granted per module. */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

/** appointments.status — only `confirmed` occupies a slot (plan §4). */
export enum AppointmentStatus {
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

/** Doctor's post-checkup marking. */
export enum ConsultationStatus {
  PENDING = 'pending',
  DONE = 'done',
  ON_HOLD = 'on_hold',
  REJECTED = 'rejected',
}

/** Payment lifecycle (pre-gateway). */
export enum PaymentStatus {
  PAID_UNVERIFIED = 'paid_unverified',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/** Where a booking originated. */
export enum BookingSource {
  APP = 'app',
  WEB = 'web',
}

/** schedule_exceptions.type */
export enum ScheduleExceptionType {
  LEAVE = 'leave',
  CUSTOM = 'custom',
}
