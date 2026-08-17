import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from '../database/models/tenant.model';
import { Doctor } from '../database/models/doctor.model';
import { User } from '../database/models/user.model';
import { Role } from '../database/models/role.model';
import { Permission } from '../database/models/permission.model';
import { RolePermission } from '../database/models/role-permission.model';
import { OpdSchedule } from '../database/models/opd-schedule.model';
import { ScheduleException } from '../database/models/schedule-exception.model';
import { Appointment } from '../database/models/appointment.model';
import { PatientReport } from '../database/models/patient-report.model';
import { TenantInterceptor } from './tenant.interceptor';
import { registerTenantHooks } from './tenant-hooks';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { RegistrationService } from './registration.service';
import { UploadsModule } from '../uploads/uploads.module';

// Registers Sequelize hooks after the SequelizeModule has initialized all models.
// Patients and patient OTPs are deliberately absent: those are global identities,
// not tenant-owned rows. Only what hangs off a patient is tenant-scoped.
@Injectable()
class TenantHooksInit implements OnModuleInit {
  onModuleInit() {
    [
      Doctor,
      User,
      Role,
      OpdSchedule,
      ScheduleException,
      Appointment,
      PatientReport,
    ].forEach((model) => registerTenantHooks(model as any));
  }
}

@Module({
  imports: [
    SequelizeModule.forFeature([Tenant, Doctor, User, Role, Permission, RolePermission, OpdSchedule, ScheduleException, Appointment]),
    UploadsModule,
  ],
  controllers: [TenantSettingsController],
  providers: [TenantInterceptor, TenantSettingsService, RegistrationService, TenantHooksInit],
  exports: [TenantInterceptor, TenantSettingsService, RegistrationService],
})
export class TenantModule {}
