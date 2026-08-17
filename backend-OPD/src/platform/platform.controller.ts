import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformOnly } from '../common/decorators/platform-only.decorator';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/enums';

function assertPlatform(user: AuthUser) {
  if (user.type !== UserType.SUPER_ADMIN) {
    throw new AppException(ErrorCode.FORBIDDEN, {
      message: 'Platform console is restricted to super_admin.',
    });
  }
}

@ApiTags('Platform (Super Admin)')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform')
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants' })
  list(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.service.listTenants();
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Tenant detail + stats' })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertPlatform(user);
    return this.service.getTenant(id);
  }

  @Patch('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a tenant' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertPlatform(user);
    return this.service.suspend(id);
  }

  @Patch('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended tenant' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertPlatform(user);
    return this.service.reactivate(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide metrics' })
  stats(@CurrentUser() user: AuthUser) {
    assertPlatform(user);
    return this.service.platformStats();
  }
}
