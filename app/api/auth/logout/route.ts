import { withTenant } from '@/src/server/tenant/route';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  clearRefreshCookieOptions,
  REFRESH_COOKIE,
  revokeRefreshToken,
} from '@/src/server/auth';
import { requireSameOrigin } from '@/src/server/security';
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from '@/app/lib/session';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_COOKIE)?.value;

  if (token) {
    try {
      await revokeRefreshToken(token);
    } catch {
      // Logout must always clear local cookies even if token revocation fails.
    }
  }

  const res = NextResponse.json({ message: 'تم تسجيل الخروج بنجاح' });

  // Clear refresh cookie at path /
  const clearOpts = clearRefreshCookieOptions();
  res.cookies.set(REFRESH_COOKIE, '', clearOpts);

  // Clear legacy path /api/auth cookie if present on existing clients
  res.cookies.set(REFRESH_COOKIE, '', {
    ...clearOpts,
    path: '/api/auth',
  });

  res.cookies.set('tenant_slug', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });

  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: SESSION_COOKIE_PATH,
    expires: new Date(0),
  });

  return res;
}

export const POST = withTenant(POSTHandler);
