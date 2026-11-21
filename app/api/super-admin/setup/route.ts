import { NextResponse } from 'next/server';
import {
  setupSuperAdmin,
  issueSuperAdminSession,
  superAdminAccessCookieOptions,
  superAdminRefreshCookieOptions,
  superAdminSessionCookieOptions,
  SUPER_ADMIN_COOKIE_ACCESS,
  SUPER_ADMIN_COOKIE_REFRESH,
  SUPER_ADMIN_COOKIE_SESSION,
  SuperAdminError,
  checkSuperAdminAttemptLimit,
  recordSuperAdminFailedAttempt,
  clearSuperAdminFailedAttempts,
} from '@/src/server/super-admin/auth';
import {
  getRequestIp,
  rateLimit,
  rateLimitedResponse,
  requireSameOrigin,
} from '@/src/server/security';

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const ip = getRequestIp(req);
  const limit = rateLimit(`super-admin-setup:${ip}`, 5, 15 * 60); // 5 attempts per 15 minutes
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSeconds);
  }

  const durableLimit = await checkSuperAdminAttemptLimit('setup', ip);
  if (!durableLimit.allowed) {
    return rateLimitedResponse(durableLimit.retryAfterSeconds);
  }

  let body: { password?: unknown; confirmPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'بيانات غير صالحة', code: 'INVALID_REQUEST' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    await setupSuperAdmin(body.password, body.confirmPassword, ip);
    await clearSuperAdminFailedAttempts('setup', ip);

    // Auto-login upon successful first-time setup
    const userAgent = req.headers.get('user-agent');
    const session = await issueSuperAdminSession({ ip, userAgent });

    const res = NextResponse.json(
      {
        success: true,
        message: 'تم إنشاء حساب المدير العام بنجاح وتفعيل الوصول.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );

    res.cookies.set(SUPER_ADMIN_COOKIE_ACCESS, session.accessToken, superAdminAccessCookieOptions());
    res.cookies.set(SUPER_ADMIN_COOKIE_REFRESH, session.refreshToken, superAdminRefreshCookieOptions(session.expiresAt));
    res.cookies.set(SUPER_ADMIN_COOKIE_SESSION, '1', superAdminSessionCookieOptions());

    return res;
  } catch (error: unknown) {
    if (error instanceof SuperAdminError) {
      if (error.code !== 'SETUP_ALREADY_COMPLETED' && error.status < 500) {
        await recordSuperAdminFailedAttempt('setup', ip).catch(() => undefined);
      }
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    console.error('Super admin setup error:', error);
    return NextResponse.json(
      { message: 'فشل إعداد حساب المدير العام', code: 'SETUP_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
