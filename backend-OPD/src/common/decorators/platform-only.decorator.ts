import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';
/** Mark a route as platform super_admin only. */
export const PlatformOnly = () => SetMetadata(PLATFORM_ONLY_KEY, true);
