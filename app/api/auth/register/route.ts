import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import { platformQueryOne } from '@/src/server/platform/db';
import {
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
} from '@/src/server/auth';
import { createOtp } from '@/src/server/otp';
import { sendVerificationEmail } from '@/src/server/email';
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
    churchCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات التسجيل غير صالحة');
  }

  const ip = getRequestIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const requestedSlug = typeof body.church === 'string'
    ? body.church
    : typeof body.churchSlug === 'string'
      ? body.churchSlug
      : '';
  let explicitSlug = requestedSlug.trim().toLowerCase() || null;

  // Church invitation code. The code only identifies a church; it can never
  // grant a role. It is validated centrally before the tenant database is
  // touched, and the resolved slug must still match the request host.
  const rawChurchCode = typeof body.churchCode === 'string' ? body.churchCode.trim().toUpperCase() : '';
  if (rawChurchCode) {
    if (rawChurchCode.length > 64) {
      return badRequest('رمز دعوة الكنيسة غير صالح أو منتهي الصلاحية');
    }
    const codeRow = await platformQueryOne<{ slug: string }>(
      `SELECT c."slug"
       FROM "church_codes" cc
       JOIN "churches" c ON c."id" = cc."churchId"
       WHERE upper(cc."code") = upper($1)
         AND cc."revoked" = false
         AND (cc."expiresAt" IS NULL OR cc."expiresAt" > now())
         AND c."status" = 'active'
       LIMIT 1`,
      [rawChurchCode],
    );
    if (!codeRow) {
      return badRequest('رمز دعوة الكنيسة غير صالح أو منتهي الصلاحية');
    }
    if (explicitSlug && explicitSlug !== codeRow.slug) {
      return badRequest('رمز الدعوة لا يخص الكنيسة المحددة');
    }
    explicitSlug = codeRow.slug;
  }

  return withResolvedTenant(
    req,
    explicitSlug,
    async (_req, tenant) => {
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

      const existing = await queryOne<{ id: string }>(
        `SELECT "id" FROM "users"
         WHERE lower("email") = $1 OR "phone" = $2 LIMIT 1`,
        [email, phone],
      );

      if (existing) {
        // Generic message that avoids revealing whether email or phone already exists
        return conflict('إذا كان لديك حساب بالفعل، يرجى تسجيل الدخول أو استعادة كلمة المرور');
      }

      const hashedPassword = await hashPassword(password);

      // Create inactive, unverified user with chosen servantRole preserved
      const user = await queryOne<{
        id: string;
        name: string;
        email: string;
      }>(
        `INSERT INTO "users"
           ("id", "name", "email", "emailVerified", "isActive", "phone", "password", "role", "servantRole", "grades", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, false, false, $3, $4, 'servant', $5, $6::users_grades_enum[], now(), now())
         RETURNING "id", "name", "email"`,
        [name, email, phone, hashedPassword, servantRole, assignedGrades],
      );

      if (!user) {
        return serverError('فشل إنشاء الحساب');
      }

      // Generate verification code and attempt to send email.
      // If delivery fails in production we roll back the user record so the
      // visitor can try again (email/phone not yet claimed in the DB).
      const { code } = await createOtp(user.id, 'email_verification');
      const sent = await sendVerificationEmail(user.email, code);

      if (!sent && process.env.NODE_ENV === 'production') {
        // Rollback: delete the just-created inactive user so their email/phone
        // remains available for a future registration attempt.
        await query(
          `DELETE FROM "users" WHERE "id" = $1 AND "isActive" = false AND "emailVerified" = false`,
          [user.id],
        );
        return serverError('تعذر إرسال رمز التحقق إلى بريدك الإلكتروني، يرجى المحاولة لاحقاً');
      }

      const res = NextResponse.json({
        requiresEmailVerification: true,
        email: user.email,
        message: 'تم إنشاء الحساب بنجاح. يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني لتفعيل الحساب.',
        church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
      });

      return applyTenantCookie(res, tenant.slug);
    } catch (error: unknown) {
      console.error('Registration error:', error);
      return serverError('حدث خطأ أثناء إنشاء الحساب');
    }
    },
    // A valid invitation code must win over a stale church cookie so a
    // visitor can register with a different church's code from the central
    // domain. Host-based resolution still rejects cross-church attempts.
    { ignoreCookie: Boolean(rawChurchCode) },
  );
}
