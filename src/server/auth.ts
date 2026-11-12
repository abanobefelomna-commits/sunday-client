import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { query, queryOne } from './db';
import { getJwtSecret } from './platform/config';
import { requireTenantContext } from './tenant/context';

const ACCESS_TOKEN_EXPIRY = Number(process.env.JWT_EXPIRES_SECONDS || 900);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);

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

export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل';
  }
  if (password.length > 200) return 'كلمة المرور أطول من الحد المسموح';
  return null;
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
  const row = await queryOne<{ id: string; userId: string; expiresAt: Date; churchId: string | null }>(
    `SELECT "id", "userId", "expiresAt", "churchId" FROM "refresh_tokens"
     WHERE "tokenHash" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()
       AND "audience" = 'tenant' AND "churchId" = $2
     LIMIT 1`,
    [tokenHash, tenant.churchId],
  );

  if (!row || row.churchId !== tenant.churchId) {
    return null;
  }

  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "id" = $1`,
    [row.id],
  );

  return { userId: row.userId, churchId: row.churchId };
}

export async function revokeRefreshToken(rawToken?: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "tokenHash" = $1`,
    [tokenHash],
  );
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
    [userId],
  );
}

export function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    expires: expiresAt,
  };
}
