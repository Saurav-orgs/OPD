import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PatientService } from './patient.service';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientAuthGuard } from './patient-auth.guard';
import { CurrentPatient, PatientPrincipal } from './current-patient.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Patient self-service')
@ApiBearerAuth()
@Public() // bypasses the staff JwtAuthGuard/TenantGuard; PatientAuthGuard takes over
@UseGuards(PatientAuthGuard)
@Controller('patient')
export class PatientController {
  constructor(private readonly patients: PatientService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current patient profile and registration state' })
  me(@CurrentPatient() principal: PatientPrincipal) {
    return this.patients.me(principal);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Complete or update the patient profile' })
  updateMe(
    @CurrentPatient() principal: PatientPrincipal,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patients.updateMe(principal, dto);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'All appointments for this patient, across clinics' })
  listAppointments(@CurrentPatient() principal: PatientPrincipal) {
    return this.patients.listAppointments(principal);
  }

  @Get('appointments/:id')
  @ApiOperation({ summary: 'One appointment with its uploaded reports' })
  getAppointment(
    @CurrentPatient() principal: PatientPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.getAppointment(principal, id);
  }

  @Post('appointments/:id/reports')
  @ApiOperation({ summary: 'Upload a medical report (PDF or image) for an appointment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadReport(
    @CurrentPatient() principal: PatientPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.patients.uploadReport(principal, id, file);
  }

  @Delete('reports/:id')
  @ApiOperation({ summary: 'Remove an uploaded report' })
  deleteReport(
    @CurrentPatient() principal: PatientPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.deleteReport(principal, id);
  }
}
