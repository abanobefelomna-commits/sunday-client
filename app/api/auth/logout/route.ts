import { withTenant } from '@/src/server/tenant/route';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeRefreshToken } from '@/src/server/auth';
import { requireSameOrigin } from '@/src/server/security';
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from '@/app/lib/session';

async function POSTHandler(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let token: string | undefined;

  const cookieStore = await cookies();
  token = cookieStore.get('refresh_token')?.value;

  if (!token) {
    try {
      const body = await req.json();
      token = body?.refreshToken;
    } catch {
      // ignore
    }
  }

  if (token) {
    await revokeRefreshToken(token);
  }

  const res = NextResponse.json({ message: 'تم تسجيل الخروج' });
  res.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    expires: new Date(0),
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
