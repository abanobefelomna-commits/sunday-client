import { createHmac, randomInt } from 'crypto';
import { query, queryOne } from './db';

const OTP_SECRET = process.env.OTP_SECRET || '75b6e92b980571ad5f6e352a302617fa559d24e5d9890619d04b22eceebc4cd2';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

function hashOtp(code: string): string {
  return createHmac('sha256', OTP_SECRET).update(code).digest('hex');
}

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

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
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

  const record = await queryOne<{
    id: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
  }>(
    `SELECT "id", "codeHash", "expiresAt", "attempts", "consumedAt"
     FROM "otp_codes"
     WHERE "userId" = $1 AND "purpose" = $2 AND "consumedAt" IS NULL
     ORDER BY "createdAt" DESC LIMIT 1`,
    [userId, purpose],
  );

  if (!record) {
    return { valid: false, message: 'الكود غير موجود أو انتهت صلاحيته، اطلب كودًا جديدًا' };
  }

  if (new Date() > new Date(record.expiresAt)) {
    return { valid: false, message: 'انتهت صلاحية الكود، اطلب كودًا جديدًا' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { valid: false, message: 'تم استنفاد محاولات التحقق، اطلب كودًا جديدًا' };
  }

  // Increment attempts count
  await query(
    `UPDATE "otp_codes" SET "attempts" = "attempts" + 1 WHERE "id" = $1`,
    [record.id],
  );

  const candidateHash = hashOtp(code);
  if (candidateHash !== record.codeHash) {
    return { valid: false, message: 'كود التحقق غير صحيح' };
  }

  // Mark as consumed
  await query(
    `UPDATE "otp_codes" SET "consumedAt" = now() WHERE "id" = $1`,
    [record.id],
  );

  return { valid: true };
}
