import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Patient } from '../database/models/patient.model';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PatientJwtPayload } from './patient-auth.service';

/**
 * Authenticates a patient-scoped token. Patient routes are marked @Public() so
 * the staff JwtAuthGuard/TenantGuard skip them, and this guard takes over.
 *
 * The `scope` check is what keeps the two token families apart: a staff token
 * can never satisfy this guard, and a patient token can never satisfy the staff
 * strategy (its `sub` is a mobile number, so no user resolves).
 */
@Injectable()
export class PatientAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(Patient) private readonly patientModel: typeof Patient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppException(ErrorCode.UNAUTHORIZED);

    let payload: PatientJwtPayload;
    try {
      payload = this.jwt.verify<PatientJwtPayload>(token, {
        secret: this.config.get('jwt').secret,
      });
    } catch {
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    if (payload?.scope !== 'patient' || !payload.sub) {
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    // Resolve fresh each request so a just-completed profile is picked up.
    req.patientMobile = payload.sub;
    req.patient = await this.patientModel.findOne({
      where: { mobile: payload.sub },
    });
    return true;
  }
}
