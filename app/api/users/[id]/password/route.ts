import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  hashPassword,
  revokeAllUserRefreshTokens,
  validatePasswordStrength,
  verifyPassword,
} from '@/src/server/auth';
import {
  getAuthUser,
  jsonResponse,
  notFound,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from '@/src/server/middleware';
import { getRequestIp, rateLimit, rateLimitedResponse, requireSameOrigin } from '@/src/server/security';
import { isUuid } from '@/src/server/validation';

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) return unauthorized();
    if (!isUuid(id)) return notFound('المستخدم غير موجود');
    if (auth.sub !== id) {
      return forbidden('يمكنك تغيير كلمة مرور حسابك فقط');
    }

    const limit = rateLimit(`password:${getRequestIp(req)}:${id}`, 5, 15 * 60);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = await req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return badRequest('كلمة المرور الحالية والجديدة مطلوبة');
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return badRequest(passwordError);

    const user = await queryOne<{ id: string; password: string }>(
      `SELECT "id", "password" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!user) return notFound('المستخدم غير موجود');

    const isValid = await verifyPassword(user.password, oldPassword);
    if (!isValid) {
      return badRequest('كلمة المرور الحالية غير صحيحة');
    }

    const hashedPassword = await hashPassword(newPassword);

    await query(
      `UPDATE "users" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [hashedPassword, id],
    );

    // Invalidate every other session after a password change.
    await revokeAllUserRefreshTokens(id);

    return jsonResponse({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Change password error:', error);
    return serverError('حدث خطأ أثناء تغيير كلمة المرور');
  }
}

export const PATCH = withTenant(PATCHHandler);
