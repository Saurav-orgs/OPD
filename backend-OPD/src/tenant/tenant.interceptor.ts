import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant-context';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/enums';

/**
 * Runs immediately after JwtAuthGuard resolves `request.user`.
 * Populates the AsyncLocalStorage tenant context for the lifetime of the
 * request so all services can call getTenantContext() without extra DI.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;

    const isPlatform = !user || user.type === UserType.SUPER_ADMIN;
    const tenantId = isPlatform ? null : (user.tenantId ?? null);

    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId, isPlatform }, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
