import { query, queryOne } from './db';
import {
  evaluateOtpCandidate,
  generateOtpCode,
  hashOtp,
  hashesEqual,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type OtpVerificationOutcome,
} from './otp-core';

export {
  evaluateOtpCandidate,
  generateOtpCode,
  hashOtp,
  hashesEqual,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type OtpVerificationOutcome,
};

export async function createOtp(
  userId: string,
  purpose = 'password_reset',
): Promise<{ code: string; expiresAt: Date }> {
  // Invalidate any existing active OTP for this user and purpose
  await query(
    `UPDATE "otp_codes" SET "consumedAt" = now()
     WHERE "userId" = $1 AND "purpose" = $2 AND "consumedAt" IS NULL`,
    [userId, purpose],
  );

  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO "otp_codes" ("id", "userId", "purpose", "codeHash", "expiresAt", "attempts", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, 0, now())`,
    [userId, purpose, codeHash, expiresAt],
  );

  return { code, expiresAt };
}

export async function verifyOtp(
  userId: string,
  code: string,
  purpose = 'password_reset',
): Promise<{ valid: boolean; message?: string }> {
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, message: 'كود التحقق يجب أن يتكون من 6 أرقام' };
  }

  const candidateHash = hashOtp(code);

  // Atomically select candidate row with FOR UPDATE, increment attempts,
  // and conditionally mark as consumed if valid and unexpired in a single CTE statement.
  const updated = await queryOne<{
    id: string;
    previousAttempts: number;
    expired: boolean;
    exhausted: boolean;
    hashMatched: boolean;
    consumed: boolean;
  }>(
    `WITH candidate AS (
       SELECT "id", "codeHash", "expiresAt", "attempts"
       FROM "otp_codes"
       WHERE "userId" = $1 AND "purpose" = $2 AND "consumedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 1
       FOR UPDATE
     )
     UPDATE "otp_codes" AS o
     SET "attempts" = o."attempts" + 1,
         "consumedAt" = CASE
           WHEN c."attempts" < $3 AND c."expiresAt" > now() AND c."codeHash" = $4
           THEN now()
           ELSE o."consumedAt"
         END
     FROM candidate c
     WHERE o."id" = c."id"
     RETURNING
       c."id",
       c."attempts" AS "previousAttempts",
       (c."expiresAt" <= now()) AS "expired",
       (c."attempts" >= $3) AS "exhausted",
       (c."codeHash" = $4) AS "hashMatched",
       (o."consumedAt" IS NOT NULL) AS "consumed"`,
    [userId, purpose, OTP_MAX_ATTEMPTS, candidateHash],
  );

  if (!updated) {
    return { valid: false, message: 'الكود غير موجود أو انتهت صلاحيته، اطلب كودًا جديدًا' };
  }

  if (updated.exhausted) {
    return { valid: false, message: 'تم استنفاد محاولات التحقق، اطلب كودًا جديدًا' };
  }

  if (updated.expired) {
    return { valid: false, message: 'انتهت صلاحية الكود، اطلب كودًا جديدًا' };
  }

  if (updated.consumed) {
    return { valid: true };
  }

  return { valid: false, message: 'كود التحقق غير صحيح' };
}
