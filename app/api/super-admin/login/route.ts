import { NextResponse } from 'next/server';
import {
  authenticateSuperAdminPassword,
  issueSuperAdminSession,
  isSuperAdminSetupCompleted,
  superAdminAccessCookieOptions,
  superAdminRefreshCookieOptions,
  superAdminSessionCookieOptions,
  SUPER_ADMIN_COOKIE_ACCESS,
  SUPER_ADMIN_COOKIE_REFRESH,
  SUPER_ADMIN_COOKIE_SESSION,
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
  const limit = rateLimit(`super-admin-login:${ip}`, 5, 15 * 60); // 5 attempts per 15 mins
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSeconds);
  }

  const durableLimit = await checkSuperAdminAttemptLimit('login', ip);
  if (!durableLimit.allowed) {
    return rateLimitedResponse(durableLimit.retryAfterSeconds);
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'بيانات غير صالحة', code: 'INVALID_REQUEST' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const isSetup = await isSuperAdminSetupCompleted();
  if (!isSetup) {
    return NextResponse.json(
      { message: 'يجب إعداد حساب المدير العام أولاً.', code: 'SETUP_REQUIRED' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const isValid = await authenticateSuperAdminPassword(body.password);
  if (!isValid) {
    await recordSuperAdminFailedAttempt('login', ip).catch(() => undefined);
    return NextResponse.json(
      { message: 'كلمة المرور غير صحيحة.', code: 'INVALID_CREDENTIALS' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  await clearSuperAdminFailedAttempts('login', ip).catch(() => undefined);

  try {
    const userAgent = req.headers.get('user-agent');
    const session = await issueSuperAdminSession({ ip, userAgent });

    const res = NextResponse.json(
      {
        success: true,
        message: 'تم تسجيل الدخول بنجاح.',
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
    console.error('Super admin login session error:', error);
    return NextResponse.json(
      { message: 'فشل إنشاء جلسة الدخول', code: 'LOGIN_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
