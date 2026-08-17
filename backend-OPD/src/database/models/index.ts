import { Tenant } from './tenant.model';
import { Role } from './role.model';
import { Permission } from './permission.model';
import { RolePermission } from './role-permission.model';
import { User } from './user.model';
import { Doctor } from './doctor.model';
import { OpdSchedule } from './opd-schedule.model';
import { ScheduleException } from './schedule-exception.model';
import { Appointment } from './appointment.model';

export const models = [
  Tenant,
  Role,
  Permission,
  RolePermission,
  User,
  Doctor,
  OpdSchedule,
  ScheduleException,
  Appointment,
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
  Appointment,
};
