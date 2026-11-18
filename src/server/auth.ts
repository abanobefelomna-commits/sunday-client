import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { query, queryOne } from './db';
import { getJwtSecret } from './platform/config';
import { requireTenantContext } from './tenant/context';
import { passwordPolicyIssue, type PasswordPolicyIssue } from '../../app/lib/password-policy';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_PATH,
  SESSION_COOKIE_VALUE,
} from '../../app/lib/session';

const ACCESS_TOKEN_EXPIRY = Number(process.env.JWT_EXPIRES_SECONDS || 900);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);
/**
 * A rotated token that is presented again shortly after rotation is usually a
 * concurrent request from another tab. Outside this window it is treated as
 * token theft and every session for that user is revoked.
 */
const REFRESH_REUSE_GRACE_SECONDS = Number(process.env.REFRESH_REUSE_GRACE_SECONDS || 30);

export const REFRESH_COOKIE = 'refresh_token';
/** The refresh cookie must be sent to the API and the logout page alike. */
export const REFRESH_COOKIE_PATH = '/';

export const TENANT_TOKEN_AUDIENCE = 'sunday-school-tenant';
const TOKEN_ISSUER = 'sunday-school-platform';

export interface JwtUserPayload extends JWTPayload {
  sub: string;
  role: string;
  name?: string;
  email?: string;
  /** Tenant (church) id. Must match the resolved tenant on every request. */
  tid: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const PASSWORD_POLICY_MESSAGES: Record<PasswordPolicyIssue, string> = {
  too_short: 'كلمة المرور يجب أن تكون ١٠ أحرف على الأقل',
  too_long: 'كلمة المرور أطول من الحد المسموح',
  missing_letter: 'كلمة المرور لازم تحتوي على حرف واحد على الأقل',
  missing_number: 'كلمة المرور لازم تحتوي على رقم واحد على الأقل',
};

export function validatePasswordStrength(password: unknown): string | null {
  const issue = passwordPolicyIssue(password);
  return issue ? PASSWORD_POLICY_MESSAGES[issue] : null;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(storedHash: string, candidate: string): Promise<boolean> {
  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, candidate);
    } catch {
      return false;
    }
  }

  // Fallback to bcrypt for legacy hashes. New hashes are always Argon2id.
  try {
    return await bcrypt.compare(candidate, storedHash);
  } catch {
    return false;
  }
}

export async function signAccessToken(payload: Omit<JwtUserPayload, 'aud' | 'iss'>): Promise<string> {
  const subject = String(payload.sub || '');
  if (!subject) throw new Error('Subject is required for tenant access tokens');
  if (!payload.tid) throw new Error('Tenant id is required for tenant access tokens');
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TENANT_TOKEN_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRY}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: TOKEN_ISSUER,
      audience: TENANT_TOKEN_AUDIENCE,
    });
    if (!payload.sub || typeof payload.tid !== 'string' || !payload.tid) return null;
    return payload as unknown as JwtUserPayload;
  } catch {
    return null;
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const tenant = requireTenantContext();
  const token = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO "refresh_tokens"
       ("id", "tokenHash", "userId", "churchId", "audience", "expiresAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, 'tenant', $4, now())`,
    [tokenHash, userId, tenant.churchId, expiresAt],
  );

  return { token, expiresAt };
}

export async function verifyAndRotateRefreshToken(
  rawToken: string,
): Promise<{ userId: string; churchId: string } | null> {
  const tenant = requireTenantContext();
  const tokenHash = hashToken(rawToken);

  // Claim the token with a single conditional update. Two concurrent refreshes
  // cannot both succeed, because only one can flip revokedAt from NULL.
  const claimed = await queryOne<{ userId: string; churchId: string }>(
    `UPDATE "refresh_tokens"
     SET "revokedAt" = now()
     WHERE "tokenHash" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()
       AND "audience" = 'tenant' AND "churchId" = $2
     RETURNING "userId", "churchId"`,
    [tokenHash, tenant.churchId],
  );

  if (claimed) {
    return { userId: claimed.userId, churchId: claimed.churchId };
  }

  // The token is not active. If it belongs to this tenant, is still unexpired
  // and was revoked a while ago, it was reused after rotation: revoke every
  // session for that user. The short grace period avoids logging out users
  // whose two tabs raced during a normal rotation.
  const reused = await queryOne<{ userId: string; revokedAt: Date; expiresAt: Date }>(
    `SELECT "userId", "revokedAt", "expiresAt" FROM "refresh_tokens"
     WHERE "tokenHash" = $1 AND "audience" = 'tenant' AND "churchId" = $2
       AND "revokedAt" IS NOT NULL
     LIMIT 1`,
    [tokenHash, tenant.churchId],
  );

  if (reused && new Date(reused.expiresAt).getTime() > Date.now()) {
    const revokedAgoMs = Date.now() - new Date(reused.revokedAt).getTime();
    if (revokedAgoMs > REFRESH_REUSE_GRACE_SECONDS * 1000) {
      await revokeAllUserRefreshTokens(reused.userId);
      console.warn('[auth] Refresh token reuse detected; all user sessions revoked.');
    }
  }

  return null;
}

export async function revokeRefreshToken(rawToken?: string | null): Promise<void> {
  if (!rawToken) return;
  const tenant = requireTenantContext();
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now()
     WHERE "tokenHash" = $1 AND "churchId" = $2`,
    [tokenHash, tenant.churchId],
  );
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const tenant = requireTenantContext();
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now()
     WHERE "userId" = $1 AND "churchId" = $2 AND "revokedAt" IS NULL`,
    [userId, tenant.churchId],
  );
}

export function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  };
}

export function refreshCookie(token: string, expiresAt: Date) {
  return [REFRESH_COOKIE, token, refreshCookieOptions(expiresAt)] as const;
}

export function clearRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: REFRESH_COOKIE_PATH,
    expires: new Date(0),
  };
}

/**
 * HttpOnly routing cookie. It carries no user data and is not accepted as an
 * API credential; it only lets the proxy distinguish signed-in navigations.
 */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: SESSION_COOKIE_PATH,
    expires: expiresAt,
  };
}

export function sessionCookie(expiresAt: Date) {
  return [SESSION_COOKIE, SESSION_COOKIE_VALUE, sessionCookieOptions(expiresAt)] as const;
}
