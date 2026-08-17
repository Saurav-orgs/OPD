import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Patient } from '../database/models/patient.model';

export interface PatientPrincipal {
  /** Verified mobile from the token. Present even before a profile exists. */
  mobile: string;
  /** Null until the patient completes registration (name/age/gender). */
  patient: Patient | null;
}

export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientPrincipal => {
    const req = ctx.switchToHttp().getRequest();
    return { mobile: req.patientMobile, patient: req.patient ?? null };
  },
);
