import { withTenant } from '@/src/server/tenant/route';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryOne } from '@/src/server/db';
import {
  verifyAndRotateRefreshToken,
  issueRefreshToken,
  signAccessToken,
  refreshCookie,
  sessionCookie,
  REFRESH_COOKIE,
} from '@/src/server/auth';
import { unauthorized, serverError, getAccessContext } from '@/src/server/middleware';
import { requireTenantContext } from '@/src/server/tenant/context';
import { getRequestIp, rateLimit, rateLimitedResponse, requireSameOrigin } from '@/src/server/security';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const limit = rateLimit(`refresh:${getRequestIp(req)}`, 60, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!token) {
      return unauthorized('جلسة الدخول منتهية أو غير موجودة');
    }

    const rotated = await verifyAndRotateRefreshToken(token);
    if (!rotated) {
      return unauthorized('جلسة الدخول منتهية أو غير صالحة');
    }

    const tenant = requireTenantContext();

    const user = await queryOne<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      grades: string[];
      avatar: string | null;
      isActive: boolean;
    }>(
      `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "isActive"
       FROM "users" WHERE "id" = $1 LIMIT 1`,
      [rotated.userId],
    );

    if (!user || !user.isActive) {
      return unauthorized('المستخدم غير موجود');
    }

    const { isActive: _active, ...safeUser } = user;

    const payload = {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      tid: tenant.churchId,
    };
    const access = await getAccessContext(payload);
    const accessToken = await signAccessToken(payload);

    const newRefreshToken = await issueRefreshToken(user.id);

    const res = NextResponse.json({
      accessToken,
      user: {
        ...safeUser,
        servantRole: access.servantRole,
        servantId: access.servantId,
        classIds: access.classIds,
        ledClassIds: access.ledClassIds ?? [],
        permissions: access.permissions,
      },
      church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
    });

    const [refreshName, refreshVal, refreshOpts] = refreshCookie(
      newRefreshToken.token,
      newRefreshToken.expiresAt,
    );
    res.cookies.set(refreshName, refreshVal, refreshOpts);

    const [sessionName, sessionValue, sessionOptions] = sessionCookie(newRefreshToken.expiresAt);
    res.cookies.set(sessionName, sessionValue, sessionOptions);

    return res;
  } catch (error) {
    console.error('Refresh error:', error);
    return serverError('حدث خطأ أثناء تجديد الجلسة');
  }
}

export const POST = withTenant(POSTHandler);
