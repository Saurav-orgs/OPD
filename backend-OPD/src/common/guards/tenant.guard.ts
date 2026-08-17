import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { UserType } from '../enums';
import { TenantStatus } from '../../database/models/tenant.model';

/**
 * Runs after JwtAuthGuard.
 *
 * Rejects:
 *  - tenant users whose tenant is suspended
 *  - tenant users who somehow lack a tenantId (data integrity guard)
 *
 * Platform super_admin passes unconditionally.
 * Public (@Public()) routes skip both auth + this guard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return true; // JwtAuthGuard will have already rejected this

    if (user.type === UserType.SUPER_ADMIN) return true;

    if (!user.tenantId) {
      throw new AppException(ErrorCode.UNAUTHORIZED, {
        message: 'This account is not associated with a practice.',
      });
    }

    if (user.tenantStatus === TenantStatus.SUSPENDED) {
      throw new AppException(ErrorCode.TENANT_SUSPENDED);
    }

    return true;
  }
}
