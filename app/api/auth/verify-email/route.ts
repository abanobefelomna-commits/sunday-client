import { NextResponse } from 'next/server';
import { queryOne } from '@/src/server/db';
import {
  issueRefreshToken,
  normalizeEmail,
  refreshCookie,
  sessionCookie,
  signAccessToken,
} from '@/src/server/auth';
import { createOtp, verifyOtp } from '@/src/server/otp';
import { sendVerificationEmail } from '@/src/server/email';
import { syncServantFromUser } from '@/src/server/servants';
import { badRequest, serverError, getAccessContext } from '@/src/server/middleware';
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
    code?: string;
    action?: string;
    church?: string;
    churchSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات غير صالحة');
  }

  const rawEmail = String(body.email || '').trim();
  const email = normalizeEmail(rawEmail);
  const code = String(body.code || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  const explicitSlug = (body.church || body.churchSlug || '').trim().toLowerCase() || null;

  if (!email) {
    return badRequest('البريد الإلكتروني مطلوب');
  }

  const ip = getRequestIp(req);

  return withResolvedTenant(req, explicitSlug, async (_req, tenant) => {
    try {
      // -----------------------------------------------------------------------
      // Resend verification code
      // -----------------------------------------------------------------------
      if (action === 'resend') {
        const resendLimit = rateLimit(`resend-verify:${ip}:${email}`, 3, 10 * 60);
        if (!resendLimit.allowed) {
          return rateLimitedResponse(resendLimit.retryAfterSeconds);
        }

        const unverifiedUser = await queryOne<{ id: string; email: string; emailVerified: boolean }>(
          `SELECT "id", "email", "emailVerified" FROM "users"
           WHERE lower("email") = $1 LIMIT 1`,
          [email],
        );

        if (unverifiedUser && !unverifiedUser.emailVerified) {
          const { code: newCode } = await createOtp(unverifiedUser.id, 'email_verification');
          await sendVerificationEmail(unverifiedUser.email, newCode);
        }

        // Generic response to avoid account enumeration
        return NextResponse.json({
          success: true,
          message: 'إذا كان الحساب مسجلاً وبحاجة إلى تأكيد، تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.',
        });
      }

      // -----------------------------------------------------------------------
      // Verify email with 6-digit OTP
      // -----------------------------------------------------------------------
      const verifyLimit = rateLimit(`verify-email:${ip}:${email}`, 10, 15 * 60);
      if (!verifyLimit.allowed) {
        return rateLimitedResponse(verifyLimit.retryAfterSeconds);
      }

      if (!code) {
        return badRequest('رمز التحقق مطلوب');
      }

      const user = await queryOne<{
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        servantRole: string | null;
        grades: string[];
        avatar: string | null;
        emailVerified: boolean;
        isActive: boolean;
      }>(
        `SELECT "id", "name", "email", "phone", "role", "servantRole", "grades", "avatar", "emailVerified", "isActive"
         FROM "users"
         WHERE lower("email") = $1
         LIMIT 1`,
        [email],
      );

      if (!user) {
        return badRequest('البريد الإلكتروني أو رمز التحقق غير صالح');
      }

      if (user.emailVerified && user.isActive) {
        return badRequest('تم تأكيد الحساب بالفعل، يمكنك تسجيل الدخول مباشرة');
      }

      const otpResult = await verifyOtp(user.id, code, 'email_verification');
      if (!otpResult.valid) {
        return badRequest(otpResult.message || 'رمز التحقق غير صحيح');
      }

      // Activate user account
      const activatedUser = await queryOne<{
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        servantRole: string | null;
        grades: string[];
        avatar: string | null;
      }>(
        `UPDATE "users"
         SET "emailVerified" = true,
             "isActive" = true,
             "updatedAt" = now()
         WHERE "id" = $1
         RETURNING "id", "name", "email", "phone", "role", "servantRole", "grades", "avatar"`,
        [user.id],
      );

      if (!activatedUser) {
        return serverError('فشل تفعيل الحساب');
      }

      // Sync the servant record and establish an unambiguous userId link.
      // A conflicting legacy phone/email must not block an already verified
      // account from signing in; an administrator can resolve the duplicate.
      try {
        await syncServantFromUser({
          userId: activatedUser.id,
          name: activatedUser.name,
          phone: activatedUser.phone,
          email: activatedUser.email,
          role: activatedUser.role,
          servantRole: activatedUser.servantRole || undefined,
          avatar: activatedUser.avatar,
          grades: activatedUser.grades,
        });
      } catch (syncError) {
        console.error('Servant sync after email verification failed:', syncError);
      }

      const payload = {
        sub: activatedUser.id,
        role: activatedUser.role,
        name: activatedUser.name,
        email: activatedUser.email,
        tid: tenant.churchId,
      };
      const access = await getAccessContext(payload);

      // Sign tokens and set cookies
      const accessToken = await signAccessToken(payload);

      const refreshToken = await issueRefreshToken(activatedUser.id);

      const res = NextResponse.json({
        accessToken,
        user: {
          ...activatedUser,
          servantRole: access.servantRole,
          classIds: access.classIds,
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
    } catch (error: unknown) {
      console.error('Email verification error:', error);
      return serverError('حدث خطأ أثناء تأكيد البريد الإلكتروني');
    }
  });
}
