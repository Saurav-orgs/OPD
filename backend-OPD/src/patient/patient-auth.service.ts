import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Patient } from '../database/models/patient.model';
import { PatientOtp } from '../database/models/patient-otp.model';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { OTP_SENDER, OtpSender } from './otp-sender';
import { isValidMobile, normalizeMobile } from './mobile.util';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface PatientJwtPayload {
  /** The mobile number — stable even before a patient row exists. */
  sub: string;
  pid: string | null;
  scope: 'patient';
}

/** Patient fields safe to return to the client (no soft-delete/audit columns). */
export interface PublicPatient {
  id: string;
  mobile: string;
  name: string;
  age: number | null;
  gender: string | null;
}

@Injectable()
export class PatientAuthService {
  constructor(
    @InjectModel(Patient) private readonly patientModel: typeof Patient,
    @InjectModel(PatientOtp) private readonly otpModel: typeof PatientOtp,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  /**
   * Issue a fresh code. Always reports success, even for numbers we've never
   * seen — otherwise this endpoint becomes a way to test whether a given person
   * is a patient on the platform.
   */
  async requestOtp(rawMobile: string): Promise<{ sent: true; expiresInSeconds: number }> {
    const mobile = normalizeMobile(rawMobile);
    if (!isValidMobile(mobile)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        message: 'Please enter a valid 10-digit mobile number.',
      });
    }

    // Retire any code still outstanding for this number.
    await this.otpModel.update(
      { consumed_at: new Date() },
      { where: { mobile, consumed_at: null } },
    );

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.otpModel.create({
      mobile,
      code_hash: await bcrypt.hash(code, 10),
      expires_at: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    } as any);

    await this.sender.send(mobile, code);
    return { sent: true, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  /**
   * Exchange a valid code for a patient token. `patient` is null when this
   * mobile has no profile yet — the client then collects name/age/gender and
   * calls PATCH /patient/me, which creates the record.
   */
  async verifyOtp(
    rawMobile: string,
    code: string,
  ): Promise<{
    accessToken: string;
    patient: PublicPatient | null;
    isNew: boolean;
  }> {
    const mobile = normalizeMobile(rawMobile);

    const otp = await this.otpModel.findOne({
      where: { mobile, consumed_at: null },
      order: [['created_at', 'DESC']],
    });
    if (!otp) throw new AppException(ErrorCode.OTP_INVALID);

    if (otp.expires_at.getTime() < Date.now()) {
      throw new AppException(ErrorCode.OTP_EXPIRED);
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new AppException(ErrorCode.OTP_TOO_MANY_ATTEMPTS);
    }

    const ok = await bcrypt.compare(code, otp.code_hash);
    if (!ok) {
      await otp.increment('attempts');
      throw new AppException(ErrorCode.OTP_INVALID);
    }

    await otp.update({ consumed_at: new Date() });

    const patient = await this.patientModel.findOne({ where: { mobile } });
    return {
      accessToken: this.signToken(mobile, patient?.id ?? null),
      patient: patient
        ? {
            id: patient.id,
            mobile: patient.mobile,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
          }
        : null,
      isNew: !patient,
    };
  }

  signToken(mobile: string, patientId: string | null): string {
    const payload: PatientJwtPayload = {
      sub: mobile,
      pid: patientId,
      scope: 'patient',
    };
    return this.jwt.sign(payload, {
      secret: this.config.get('jwt').secret,
      expiresIn: '30d',
    });
  }

  /** Housekeeping: drop codes that expired over a day ago. */
  async purgeExpired(): Promise<number> {
    return this.otpModel.destroy({
      where: { expires_at: { [Op.lt]: new Date(Date.now() - 86_400_000) } },
    });
  }
}
