import { Injectable, Logger } from '@nestjs/common';

export const OTP_SENDER = 'OTP_SENDER';

/**
 * Delivery channel for one-time codes. Swapping in MSG91/Twilio for production
 * means writing one more class and rebinding OTP_SENDER in PatientModule —
 * nothing else in the OTP flow changes.
 */
export interface OtpSender {
  send(mobile: string, code: string): Promise<void>;
}

/**
 * Development sender: writes the code to the server log instead of sending an
 * SMS. Never bind this in production — it means anyone who can read the logs
 * can sign in as any patient.
 */
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger('OtpSender');

  async send(mobile: string, code: string): Promise<void> {
    this.logger.warn(
      `[DEV] OTP for ${mobile} is ${code} — no SMS was sent. ` +
        'Bind a real OtpSender before going to production.',
    );
  }
}
