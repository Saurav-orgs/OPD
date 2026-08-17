import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { Doctor } from '../database/models/doctor.model';
import { Tenant } from '../database/models/tenant.model';

@Module({
  imports: [SequelizeModule.forFeature([Doctor, Tenant])],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
