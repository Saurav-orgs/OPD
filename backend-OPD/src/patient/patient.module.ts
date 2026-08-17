import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { Patient } from '../database/models/patient.model';
import { PatientOtp } from '../database/models/patient-otp.model';
import { PatientReport } from '../database/models/patient-report.model';
import { Appointment } from '../database/models/appointment.model';
import { Doctor } from '../database/models/doctor.model';
import { Tenant } from '../database/models/tenant.model';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthGuard } from './patient-auth.guard';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { ConsoleOtpSender, OTP_SENDER } from './otp-sender';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt').secret,
      }),
    }),
    SequelizeModule.forFeature([
      Patient,
      PatientOtp,
      PatientReport,
      Appointment,
      Doctor,
      Tenant,
    ]),
    UploadsModule,
  ],
  controllers: [PatientAuthController, PatientController],
  providers: [
    PatientAuthService,
    PatientService,
    PatientAuthGuard,
    // Swap this binding for an SMS-backed sender in production.
    { provide: OTP_SENDER, useClass: ConsoleOtpSender },
  ],
  exports: [PatientService, PatientAuthService],
})
export class PatientModule {}
