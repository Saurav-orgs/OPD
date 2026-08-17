import { Tenant } from './tenant.model';
import { Role } from './role.model';
import { Permission } from './permission.model';
import { RolePermission } from './role-permission.model';
import { User } from './user.model';
import { Doctor } from './doctor.model';
import { OpdSchedule } from './opd-schedule.model';
import { ScheduleException } from './schedule-exception.model';
import { Patient } from './patient.model';
import { PatientOtp } from './patient-otp.model';
import { Appointment } from './appointment.model';
import { PatientReport } from './patient-report.model';

export const models = [
  Tenant,
  Role,
  Permission,
  RolePermission,
  User,
  Doctor,
  OpdSchedule,
  ScheduleException,
  Patient,
  PatientOtp,
  Appointment,
  PatientReport,
];

export {
  Tenant,
  Role,
  Permission,
  RolePermission,
  User,
  Doctor,
  OpdSchedule,
  ScheduleException,
  Patient,
  PatientOtp,
  Appointment,
  PatientReport,
};
