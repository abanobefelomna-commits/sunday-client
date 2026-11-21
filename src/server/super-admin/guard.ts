import { NextResponse } from 'next/server';
import {
  verifySuperAdminAccessToken,
  isSuperAdminAccessSessionActive,
  SUPER_ADMIN_COOKIE_ACCESS,
  SUPER_ADMIN_COOKIE_REFRESH,
  refreshSuperAdminSession,
  superAdminAccessCookieOptions,
  superAdminRefreshCookieOptions,
  type SuperAdminSessionPayload,
} from './auth.ts';
import { getRequestIp } from '../security.ts';

export interface SuperAdminAuthResult {
  authenticated: boolean;
  user: SuperAdminSessionPayload | null;
  newTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null;
}

/** Parse cookies from request headers. */
function parseCookies(req: Request): Map<string, string> {
  const cookieHeader = req.headers.get('cookie') || '';
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      map.set(trimmed.slice(0, eqIdx), decodeURIComponent(trimmed.slice(eqIdx + 1)));
    }
  }
  return map;
}

/**
 * Check if the request is authenticated as Super Admin.
 * Checks HttpOnly cookies first, then Authorization Bearer header.
 * Supports transparent session refreshment if access token has expired but refresh token is valid.
 */
export async function getSuperAdminAuth(req: Request): Promise<SuperAdminAuthResult> {
  const cookies = parseCookies(req);
  let accessToken = cookies.get(SUPER_ADMIN_COOKIE_ACCESS);

  if (!accessToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7).trim();
    }
  }

  if (accessToken) {
    const payload = await verifySuperAdminAccessToken(accessToken);
    if (payload && (await isSuperAdminAccessSessionActive(accessToken))) {
      return { authenticated: true, user: payload, newTokens: null };
    }
  }

  // If access token is missing or expired, attempt refresh using the HttpOnly refresh token
  const refreshToken = cookies.get(SUPER_ADMIN_COOKIE_REFRESH);
  if (refreshToken) {
    const ip = getRequestIp(req);
    const userAgent = req.headers.get('user-agent');
    const refreshed = await refreshSuperAdminSession(refreshToken, { ip, userAgent });
    if (refreshed) {
      const payload = await verifySuperAdminAccessToken(refreshed.accessToken);
      if (payload) {
        return {
          authenticated: true,
          user: payload,
          newTokens: refreshed,
        };
      }
    }
  }

  return { authenticated: false, user: null, newTokens: null };
}

/**
 * Require Super Admin authentication for Route Handlers.
 * Returns null if authorized, or a 401 Response if forbidden/unauthorized.
 */
export async function requireSuperAdmin(req: Request): Promise<{
  errorResponse: Response | null;
  auth: SuperAdminAuthResult;
}> {
  const auth = await getSuperAdminAuth(req);

  if (!auth.authenticated || !auth.user) {
    return {
      errorResponse: NextResponse.json(
        { message: 'غير مصرح بالوصول إلى لوحة تحكم المدير العام.', code: 'SUPER_ADMIN_UNAUTHORIZED' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      auth,
    };
  }

  return { errorResponse: null, auth };
}

/**
 * Apply refreshed session cookies to the response if a session was auto-refreshed.
 */
export function applySuperAdminRefreshCookies(
  res: NextResponse,
  newTokens?: SuperAdminAuthResult['newTokens'],
): NextResponse {
  if (newTokens) {
    res.cookies.set(
      SUPER_ADMIN_COOKIE_ACCESS,
      newTokens.accessToken,
      superAdminAccessCookieOptions(),
    );
    res.cookies.set(
      SUPER_ADMIN_COOKIE_REFRESH,
      newTokens.refreshToken,
      superAdminRefreshCookieOptions(newTokens.expiresAt),
    );
  }
  return res;
}
