import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RegistrationService } from '../tenant/registration.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registrationService: RegistrationService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Admin/doctor login → JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Doctor self-registration — creates a new practice' })
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async register(@Body() dto: RegisterDto) {
    const { tenantId, userId } = await this.registrationService.register(dto);
    // Issue a JWT for the new owner so they land straight in the onboarding wizard.
    return this.authService.loginById(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated principal + permissions' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
