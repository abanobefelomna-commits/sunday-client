import { NextResponse } from 'next/server';
import {
  revokeSuperAdminSession,
  clearSuperAdminCookieOptions,
  SUPER_ADMIN_COOKIE_ACCESS,
  SUPER_ADMIN_COOKIE_REFRESH,
  SUPER_ADMIN_COOKIE_SESSION,
} from '@/src/server/super-admin/auth';
import { requireSameOrigin } from '@/src/server/security';

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator > 0) {
      cookies.set(trimmed.slice(0, separator), decodeURIComponent(trimmed.slice(separator + 1)));
    }
  }

  const refreshToken = cookies.get(SUPER_ADMIN_COOKIE_REFRESH);
  const accessToken = cookies.get(SUPER_ADMIN_COOKIE_ACCESS);

  if (refreshToken || accessToken) {
    try {
      await revokeSuperAdminSession(refreshToken, accessToken);
    } catch (error) {
      console.error('Revoke super admin session error:', error);
    }
  }

  const res = NextResponse.json(
    { success: true, message: 'تم تسجيل الخروج بنجاح.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );

  const clearOpts = clearSuperAdminCookieOptions();
  res.cookies.set(SUPER_ADMIN_COOKIE_ACCESS, '', clearOpts);
  res.cookies.set(SUPER_ADMIN_COOKIE_REFRESH, '', clearOpts);
  res.cookies.set(SUPER_ADMIN_COOKIE_SESSION, '', clearOpts);

  return res;
}
