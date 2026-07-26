import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { ConsultationStatus, PaymentStatus } from '../../common/enums';

/** Doctor's post-checkup marking (#3). `pending` is not settable here. */
export class ConsultationDto {
  @ApiProperty({
    enum: [
      ConsultationStatus.DONE,
      ConsultationStatus.ON_HOLD,
      ConsultationStatus.REJECTED,
    ],
  })
  @IsEnum(ConsultationStatus, {
    message: 'Status must be done, on_hold, or rejected.',
  })
  status: ConsultationStatus;
}

/** Payment review (#2). `verified` keeps the slot; `rejected` frees a future slot. */
export class PaymentReviewDto {
  @ApiProperty({ enum: [PaymentStatus.VERIFIED, PaymentStatus.REJECTED] })
  @IsEnum(PaymentStatus, { message: 'Status must be verified or rejected.' })
  status: PaymentStatus;
}

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ example: '2026-07-28' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD.' })
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  status?: string;
}
