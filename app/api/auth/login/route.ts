import { NextResponse } from 'next/server';
import { queryOne } from '@/src/server/db';
import {
  verifyPassword,
  issueRefreshToken,
  signAccessToken,
  normalizeEmail,
  refreshCookie,
  sessionCookie,
} from '@/src/server/auth';
import { badRequest, unauthorized, serverError, getAccessContext } from '@/src/server/middleware';
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

      if (!user) {
        return unauthorized('بيانات الدخول غير صحيحة');
      }

      const isValid = await verifyPassword(user.password, password);
      if (!isValid) {
        return unauthorized('بيانات الدخول غير صحيحة');
      }

      if (!user.isActive) {
        return unauthorized('بيانات الدخول غير صحيحة');
      }

      const { password: _pw, isActive: _active, ...safeUser } = user;

      const payload = {
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        tid: tenant.churchId,
      };
      const access = await getAccessContext(payload);
      const accessToken = await signAccessToken(payload);

      const refreshToken = await issueRefreshToken(user.id);

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
        refreshToken.token,
        refreshToken.expiresAt,
      );
      res.cookies.set(refreshName, refreshVal, refreshOpts);

      const [sessionName, sessionValue, sessionOptions] = sessionCookie(refreshToken.expiresAt);
      res.cookies.set(sessionName, sessionValue, sessionOptions);

      return applyTenantCookie(res, tenant.slug);
    } catch (error) {
      console.error('Login error:', error);
      return serverError('حدث خطأ أثناء تسجيل الدخول');
    }
  });
}
