import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import {
  hashPassword,
  issueRefreshToken,
  normalizeEmail,
  signAccessToken,
  sessionCookie,
  validatePasswordStrength,
} from '@/src/server/auth';
import { syncServantFromUser } from '@/src/server/servants';
import { badRequest, conflict, serverError } from '@/src/server/middleware';
import { applyTenantCookie, withResolvedTenant } from '@/src/server/tenant/route';
import {
  getRequestIp,
  rateLimit,
  rateLimitedResponse,
  requireSameOrigin,
} from '@/src/server/security';

const VALID_GRADES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'general'];

/**
 * Member self-registration.
 *
 * This endpoint can never grant an administrative role: the account role is
 * always `servant`, and the only accepted service labels are `servant` and
 * `class_leader`. Administrators and priests are appointed by an existing
 * church administrator through the tenant dashboard.
 */
export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    servantRole?: string;
    grades?: unknown;
    church?: string;
    churchSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات التسجيل غير صالحة');
  }

  const ip = getRequestIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const explicitSlug = (body.church || body.churchSlug || '').trim().toLowerCase() || null;

  return withResolvedTenant(req, explicitSlug, async (_req, tenant) => {
    try {
      const name = String(body.name || '').trim();
      const email = normalizeEmail(String(body.email || ''));
      const phone = String(body.phone || '').trim();
      const password = typeof body.password === 'string' ? body.password : '';
      const grades = body.grades === undefined ? [] : body.grades;

      if (!name || !email || !phone || !password) {
        return badRequest('الاسم، البريد الإلكتروني، رقم الهاتف، وكلمة المرور مطلوبة');
      }
      if (name.length > 160) return badRequest('الاسم أطول من الحد المسموح');

      const passwordError = validatePasswordStrength(password);
      if (passwordError) return badRequest(passwordError);

      if (
        !Array.isArray(grades) ||
        grades.some((grade: unknown) => typeof grade !== 'string' || !VALID_GRADES.includes(grade))
      ) {
        return badRequest('الفصل أو القسم المختار غير صالح');
      }

      // Never trust the requested role. Administrative labels are ignored.
      const servantRole = body.servantRole === 'class_leader' ? 'class_leader' : 'servant';
      const assignedGrades = grades;

      const existing = await queryOne<{ email: string; phone: string }>(
        `SELECT "email", "phone" FROM "users"
         WHERE lower("email") = $1 OR "phone" = $2 LIMIT 1`,
        [email, phone],
      );

      if (existing) {
        return conflict(
          existing.email?.toLowerCase() === email
            ? 'الإيميل مستخدم بالفعل'
            : 'رقم التليفون مستخدم بالفعل',
        );
      }

      const hashedPassword = await hashPassword(password);

      const user = await queryOne<{
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        grades: string[];
        avatar: string | null;
      }>(
        `INSERT INTO "users"
           ("id", "name", "email", "emailVerified", "phone", "password", "role", "grades", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, true, $3, $4, 'servant', $5::users_grades_enum[], now(), now())
         RETURNING "id", "name", "email", "phone", "role", "grades", "avatar"`,
        [name, email, phone, hashedPassword, assignedGrades],
      );

      if (!user) {
        return serverError('فشل إنشاء الحساب');
      }

      await syncServantFromUser({
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        servantRole,
        avatar: user.avatar,
        grades: user.grades,
      });

      const accessToken = await signAccessToken({
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        tid: tenant.churchId,
      });

      const refreshToken = await issueRefreshToken(user.id);

      const userClasses =
        user.grades && user.grades.length > 0
          ? await query<{ id: string }>(
              `SELECT "id" FROM "classes" WHERE "grade"::text = ANY($1::text[])`,
              [user.grades],
            )
          : [];

      const res = NextResponse.json({
        accessToken,
        user: {
          ...user,
          servantRole,
          classIds: userClasses.map((c) => c.id),
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

      const [sessionName, sessionValue, sessionOptions] = sessionCookie(refreshToken.expiresAt);
      res.cookies.set(sessionName, sessionValue, sessionOptions);

      return applyTenantCookie(res, tenant.slug);
    } catch (error: unknown) {
      console.error('Registration error:', error);
      return serverError('حدث خطأ أثناء إنشاء الحساب');
    }
  });
}
