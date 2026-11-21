import { NextResponse } from 'next/server';
import { isSuperAdminSetupCompleted } from '@/src/server/super-admin/auth';
import { getSuperAdminAuth, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import { getRequestIp, rateLimit, rateLimitedResponse } from '@/src/server/security';

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const limit = rateLimit(`super-admin-status:${ip}`, 60, 60);
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSeconds);
  }

  try {
    const isSetup = await isSuperAdminSetupCompleted();
    const auth = await getSuperAdminAuth(req);

    const res = NextResponse.json(
      {
        setupRequired: !isSetup,
        authenticated: auth.authenticated,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );

    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('Super admin status check error:', error);
    return NextResponse.json(
      { message: 'فشل فحص حالة المدير العام', code: 'STATUS_CHECK_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
