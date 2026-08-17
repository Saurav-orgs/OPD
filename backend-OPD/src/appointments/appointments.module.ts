import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { PublicController } from './public.controller';
import { Appointment } from '../database/models/appointment.model';
import { Doctor } from '../database/models/doctor.model';
import { SlotsModule } from '../slots/slots.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { TenantModule } from '../tenant/tenant.module';
import { PatientModule } from '../patient/patient.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Appointment, Doctor]),
    SlotsModule,
    DoctorsModule,
    TenantModule,
    PatientModule,
  ],
  controllers: [AppointmentsController, PublicController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
