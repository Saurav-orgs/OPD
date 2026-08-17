/**
 * The mobile number IS the patient's identity, so it must normalise to exactly
 * one canonical form. Without this, "+91 98765 43210" and "9876543210" would
 * become two different people with two different medical histories.
 */
export function normalizeMobile(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  // Drop an Indian country code when it leaves a valid 10-digit subscriber number.
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isValidMobile(raw: string): boolean {
  return /^[0-9]{10}$/.test(normalizeMobile(raw));
}
