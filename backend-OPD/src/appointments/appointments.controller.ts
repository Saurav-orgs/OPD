import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentNotesDto,
  ConsultationDto,
  ListAppointmentsQueryDto,
  PaymentReviewDto,
} from './dto/manage-appointment.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionAction, PermissionModule } from '../common/enums';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments (doctors see only their own)' })
  @Permissions({ module: PermissionModule.APPOINTMENTS, action: PermissionAction.READ })
  list(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.list(query, user);
  }

  @Get(':id')
  @Permissions({ module: PermissionModule.APPOINTMENTS, action: PermissionAction.READ })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/consultation')
  @ApiOperation({ summary: 'Doctor marks visit done / on_hold / rejected' })
  @Permissions({ module: PermissionModule.APPOINTMENTS, action: PermissionAction.UPDATE })
  setConsultation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setConsultation(id, dto, user);
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Verify / reject payment (reject frees a future slot)' })
  @Permissions({ module: PermissionModule.APPOINTMENTS, action: PermissionAction.UPDATE })
  setPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setPayment(id, dto, user);
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: "Save the doctor's note for a visit" })
  @Permissions({ module: PermissionModule.APPOINTMENTS, action: PermissionAction.UPDATE })
  setNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentNotesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setNotes(id, dto, user);
  }
}
