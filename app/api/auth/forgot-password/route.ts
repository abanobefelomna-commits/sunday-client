import { withTenant } from '@/src/server/tenant/route';
import { queryOne } from '@/src/server/db';
import { createOtp } from '@/src/server/otp';
import { sendOtpEmail } from '@/src/server/email';
import { jsonResponse } from '@/src/server/middleware';
import { getRequestIp, rateLimit, rateLimitedResponse, requireSameOrigin } from '@/src/server/security';
import { normalizeEmail } from '@/src/server/auth';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const limit = rateLimit(`forgot:${getRequestIp(req)}`, 5, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  try {
    const body = await req.json();
    const rawIdentifier = String(body.email || body.phone || '').trim();
    const identifier = body.email ? normalizeEmail(rawIdentifier) : rawIdentifier;

    if (identifier) {
      const isEmail = identifier.includes('@');
      const user = await queryOne<{ id: string; email: string; name: string }>(
        isEmail
          ? `SELECT "id", "email", "name" FROM "users" WHERE lower("email") = $1 AND "isActive" = true LIMIT 1`
          : `SELECT "id", "email", "name" FROM "users" WHERE "phone" = $1 AND "isActive" = true LIMIT 1`,
        [identifier],
      );

      if (user) {
        const { code } = await createOtp(user.id, 'password_reset');
        await sendOtpEmail(user.email, code);
      }
    }
  } catch (error) {
    console.warn('[ForgotPassword] Process error:', error);
  }

  return jsonResponse({
    message: 'إذا كان الحساب مسجلًا، فسيصلك كود استعادة كلمة المرور على بريده الإلكتروني.',
  });
}

export const POST = withTenant(POSTHandler);
