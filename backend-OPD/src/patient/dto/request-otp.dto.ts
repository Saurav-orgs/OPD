import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  mobile: string;
}
