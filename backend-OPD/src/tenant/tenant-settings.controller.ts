import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tenant (Practice settings)')
@ApiBearerAuth()
@Controller('tenant')
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get practice settings' })
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Update practice settings' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.service.update(user, dto);
  }

  @Post('logo')
  @ApiOperation({ summary: 'Upload practice logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } }))
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadLogo(user, file);
  }

  @Get('onboarding')
  @ApiOperation({ summary: 'Onboarding checklist' })
  onboarding(@CurrentUser() user: AuthUser) {
    return this.service.onboarding(user);
  }

  @Post('go-live')
  @ApiOperation({ summary: 'Enable the practice (make doctor visible to patients)' })
  goLive(@CurrentUser() user: AuthUser) {
    return this.service.goLive(user);
  }
}
