import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { TenantStatus } from '../database/models/tenant.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findForAuth(dto.email);
    if (!user) throw new AppException(ErrorCode.INVALID_CREDENTIALS);

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new AppException(ErrorCode.INVALID_CREDENTIALS);

    if (!user.is_active) throw new AppException(ErrorCode.ACCOUNT_DISABLED);

    const tenant = (user as any).tenant;
    if (tenant && tenant.status === TenantStatus.SUSPENDED) {
      throw new AppException(ErrorCode.TENANT_SUSPENDED);
    }

    const principal = UsersService.toAuthUser(user);
    const token = await this.signToken(user.id, user.email, user.type, user.tenant_id);
    return { accessToken: token, user: principal };
  }

  /** Used after registration to issue a token for the new owner. */
  async loginById(userId: string) {
    const principal = await this.usersService.buildAuthUser(userId);
    if (!principal) throw new AppException(ErrorCode.ACCOUNT_DISABLED);
    const token = await this.signToken(
      principal.id,
      principal.email,
      principal.type,
      principal.tenantId,
    );
    return { accessToken: token, user: principal };
  }

  me(user: AuthUser): AuthUser {
    return user;
  }

  private signToken(
    sub: string,
    email: string,
    type: string,
    tid: string | null,
  ): Promise<string> {
    return this.jwtService.signAsync({ sub, email, type, tid });
  }
}
