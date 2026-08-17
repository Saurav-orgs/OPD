import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientAuthService } from './patient-auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Patient auth')
@Public()
@Controller('patient/auth')
export class PatientAuthController {
  constructor(private readonly auth: PatientAuthService) {}

  @Post('request-otp')
  @ApiOperation({ summary: 'Send a one-time login code to a mobile number' })
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.mobile);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Exchange a code for a patient token' })
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.mobile, dto.code);
  }
}
