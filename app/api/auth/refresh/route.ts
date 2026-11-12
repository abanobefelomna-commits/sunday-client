import { withTenant } from '@/src/server/tenant/route';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query, queryOne } from '@/src/server/db';
import {
  verifyAndRotateRefreshToken,
  issueRefreshToken,
  signAccessToken,
} from '@/src/server/auth';
import { unauthorized, serverError } from '@/src/server/middleware';
import { requireTenantContext } from '@/src/server/tenant/context';
import { getRequestIp, rateLimit, rateLimitedResponse, requireSameOrigin } from '@/src/server/security';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const limit = rateLimit(`refresh:${getRequestIp(req)}`, 60, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  try {
    let token: string | undefined;

    const cookieStore = await cookies();
    token = cookieStore.get('refresh_token')?.value;

    if (!token) {
      try {
        const body = await req.json();
        token = body.refreshToken;
      } catch {
        // no body
      }
    }

    if (!token) {
      return unauthorized('توكن التجديد غير موجود');
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

    const servant = await queryOne<{ id: string; role: string }>(
      `SELECT "id", "role" FROM "servants"
       WHERE "phone" = $1 OR ("email" IS NOT NULL AND lower("email") = lower($2))
       LIMIT 1`,
      [user.phone, user.email],
    );

    const classIds: string[] = [];
    if (servant) {
      const sc = await query<{ classesId: string }>(
        `SELECT "classesId" FROM "servants_classes" WHERE "servantsId" = $1`,
        [servant.id],
      );
      classIds.push(...sc.map((row) => row.classesId));
    }
    if (user.grades && user.grades.length > 0) {
      const gc = await query<{ id: string }>(
        `SELECT "id" FROM "classes" WHERE "grade"::text = ANY($1::text[])`,
        [user.grades],
      );
      classIds.push(...gc.map((row) => row.id));
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      tid: tenant.churchId,
    });

    const newRefreshToken = await issueRefreshToken(user.id);

    const res = NextResponse.json({
      accessToken,
      user: {
        ...safeUser,
        servantRole: servant?.role || null,
        classIds: [...new Set(classIds)],
      },
      refreshToken: newRefreshToken.token,
      church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
    });

    res.cookies.set('refresh_token', newRefreshToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      expires: newRefreshToken.expiresAt,
    });

    return res;
  } catch (error) {
    console.error('Refresh error:', error);
    return serverError('حدث خطأ أثناء تجديد الجلسة');
  }
}

export const POST = withTenant(POSTHandler);
