import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from '../database/models/tenant.model';
import { User } from '../database/models/user.model';
import { Doctor } from '../database/models/doctor.model';
import { Appointment } from '../database/models/appointment.model';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [SequelizeModule.forFeature([Tenant, User, Doctor, Appointment])],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
