import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  doctor_name: string;

  @ApiProperty()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  mobile: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @ApiPropertyOptional({ description: 'Practice name. Defaults to "Dr. {name}\'s Clinic".' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clinic_name?: string;
}
