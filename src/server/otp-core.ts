import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { getOtpSecret } from './platform/config.ts';

export const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
export const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

export function hashOtp(code: string): string {
  return createHmac('sha256', getOtpSecret()).update(code).digest('hex');
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export type OtpVerificationOutcome =
  | 'valid'
  | 'invalid_format'
  | 'not_found'
  | 'expired'
  | 'exhausted'
  | 'mismatch';

export function evaluateOtpCandidate(params: {
  candidateFound: boolean;
  codeHash?: string | null;
  expectedHash?: string | null;
  expiresAt?: Date | string | null;
  attempts?: number | null;
  maxAttempts?: number;
  now?: Date;
}): { outcome: OtpVerificationOutcome; valid: boolean; message?: string } {
  if (!params.candidateFound) {
    return {
      outcome: 'not_found',
      valid: false,
      message: 'الكود غير موجود أو انتهت صلاحيته، اطلب كودًا جديدًا',
    };
  }

  const maxAttempts = params.maxAttempts ?? OTP_MAX_ATTEMPTS;
  const attempts = params.attempts ?? 0;
  if (attempts >= maxAttempts) {
    return {
      outcome: 'exhausted',
      valid: false,
      message: 'تم استنفاد محاولات التحقق، اطلب كودًا جديدًا',
    };
  }

  const now = params.now ?? new Date();
  const expiresAt = params.expiresAt ? new Date(params.expiresAt) : null;
  if (expiresAt && now.getTime() > expiresAt.getTime()) {
    return {
      outcome: 'expired',
      valid: false,
      message: 'انتهت صلاحية الكود، اطلب كودًا جديدًا',
    };
  }

  if (
    !params.codeHash ||
    !params.expectedHash ||
    !hashesEqual(params.codeHash, params.expectedHash)
  ) {
    return {
      outcome: 'mismatch',
      valid: false,
      message: 'كود التحقق غير صحيح',
    };
  }

  return { outcome: 'valid', valid: true };
}
