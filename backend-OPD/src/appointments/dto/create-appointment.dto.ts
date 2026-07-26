import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Public booking payload (multipart — the screenshot file is separate).
 * `end_time` is derived server-side from the slot, never trusted from input.
 */
export class CreateAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    { message: 'A valid doctor is required.' },
  )
  doctor_id: string;

  @ApiProperty({ example: '2026-07-28' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Please choose a valid date (YYYY-MM-DD).',
  })
  appointment_date: string;

  @ApiProperty({ example: '11:30' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Please choose a valid time slot (HH:mm).',
  })
  start_time: string;

  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @MinLength(2, { message: 'Please enter the patient’s name.' })
  @MaxLength(120)
  patient_name: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Please enter a valid 10-digit mobile number.',
  })
  patient_mobile: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  patient_address?: string;

  @ApiPropertyOptional({ description: 'Reason for visit.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
