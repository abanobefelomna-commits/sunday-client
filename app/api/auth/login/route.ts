import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import {
  verifyPassword,
  issueRefreshToken,
  signAccessToken,
  normalizeEmail,
} from '@/src/server/auth';
import { badRequest, unauthorized, serverError } from '@/src/server/middleware';
import { applyTenantCookie, withResolvedTenant } from '@/src/server/tenant/route';
import {
  getRequestIp,
  rateLimit,
  rateLimitedResponse,
  requireSameOrigin,
} from '@/src/server/security';

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: {
    email?: string;
    phone?: string;
    password?: string;
    church?: string;
    churchSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات الدخول غير صالحة');
  }

  const rawIdentifier = String(body.email || body.phone || '').trim();
  const identifier = body.email ? normalizeEmail(rawIdentifier) : rawIdentifier;
  const password = typeof body.password === 'string' ? body.password : '';
  const explicitSlug = (body.church || body.churchSlug || '').trim().toLowerCase() || null;

  if (!identifier || !password) {
    return badRequest('البريد الإلكتروني أو رقم الهاتف وكلمة المرور مطلوبة');
  }

  const ip = getRequestIp(req);
  const limit = rateLimit(`login:${ip}:${identifier}`, 10, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  return withResolvedTenant(req, explicitSlug, async (_req, tenant) => {
    try {
      const isEmail = identifier.includes('@');
      const user = await queryOne<{
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        grades: string[];
        avatar: string | null;
        password: string;
        isActive: boolean;
      }>(
        isEmail
          ? `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "password", "isActive"
             FROM "users" WHERE lower("email") = $1 LIMIT 1`
          : `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "password", "isActive"
             FROM "users" WHERE "phone" = $1 LIMIT 1`,
        [identifier],
      );

      if (!user || !user.isActive) {
        return unauthorized('بيانات الدخول غير صحيحة');
      }

      const isValid = await verifyPassword(user.password, password);
      if (!isValid) {
        return unauthorized('بيانات الدخول غير صحيحة');
      }

      const { password: _pw, isActive: _active, ...safeUser } = user;

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
        classIds.push(...sc.map((r) => r.classesId));
      }
      if (user.grades && user.grades.length > 0) {
        const gc = await query<{ id: string }>(
          `SELECT "id" FROM "classes" WHERE "grade"::text = ANY($1::text[])`,
          [user.grades],
        );
        classIds.push(...gc.map((r) => r.id));
      }

      const accessToken = await signAccessToken({
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        tid: tenant.churchId,
      });

      const refreshToken = await issueRefreshToken(user.id);

      const res = NextResponse.json({
        accessToken,
        user: {
          ...safeUser,
          servantRole: servant?.role || null,
          classIds: [...new Set(classIds)],
        },
        refreshToken: refreshToken.token,
        church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
      });

      res.cookies.set('refresh_token', refreshToken.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        expires: refreshToken.expiresAt,
      });

      return applyTenantCookie(res, tenant.slug);
    } catch (error) {
      console.error('Login error:', error);
      return serverError('حدث خطأ أثناء تسجيل الدخول');
    }
  });
}
