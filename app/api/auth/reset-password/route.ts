import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  hashPassword,
  normalizeEmail,
  revokeAllUserRefreshTokens,
  validatePasswordStrength,
} from '@/src/server/auth';
import { verifyOtp } from '@/src/server/otp';
import { badRequest, jsonResponse, serverError } from '@/src/server/middleware';
import { getRequestIp, rateLimit, rateLimitedResponse, requireSameOrigin } from '@/src/server/security';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const limit = rateLimit(`reset:${getRequestIp(req)}`, 10, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  try {
    const body = await req.json();
    const { code, newPassword } = body;
    const rawIdentifier = String(body.email || body.phone || '').trim();
    const identifier = body.email ? normalizeEmail(rawIdentifier) : rawIdentifier;

    if (!identifier || !code || !newPassword) {
      return badRequest('البريد الإلكتروني، الكود، وكلمة المرور الجديدة مطلوبة');
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return badRequest(passwordError);

    const isEmail = identifier.includes('@');
    const user = await queryOne<{ id: string }>(
      isEmail
        ? `SELECT "id" FROM "users" WHERE lower("email") = $1 LIMIT 1`
        : `SELECT "id" FROM "users" WHERE "phone" = $1 LIMIT 1`,
      [identifier],
    );

    if (!user) {
      return badRequest('الكود غير صحيح أو انتهت صلاحيته');
    }

    const otpResult = await verifyOtp(user.id, String(code), 'password_reset');
    if (!otpResult.valid) {
      return badRequest(otpResult.message || 'الكود غير صحيح أو انتهت صلاحيته');
    }

    const hashedPassword = await hashPassword(newPassword);

    await query(
      `UPDATE "users" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [hashedPassword, user.id],
    );

    await revokeAllUserRefreshTokens(user.id);

    return jsonResponse({
      message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول مرة أخرى.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return serverError('حدث خطأ أثناء إعادة تعيين كلمة المرور');
  }
}

export const POST = withTenant(POSTHandler);
