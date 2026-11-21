import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { platformQuery, platformQueryOne } from '../platform/db.ts';
import { getPlatformJwtSecret, isProduction } from '../platform/config.ts';
import { recordPlatformAudit } from '../platform/audit.ts';
import { hashIp, sha256Hex } from '../platform/crypto.ts';
import { passwordPolicyIssue } from '../../../app/lib/password-policy.ts';

const PASSWORD_POLICY_MESSAGES: Record<string, string> = {
  too_short: 'كلمة المرور يجب أن تكون ١٠ أحرف على الأقل',
  too_long: 'كلمة المرور أطول من الحد المسموح',
  missing_letter: 'كلمة المرور لازم تحتوي على حرف واحد على الأقل',
  missing_number: 'كلمة المرور لازم تحتوي على رقم واحد على الأقل',
};

export function validateSuperAdminPassword(password: unknown): string | null {
  const issue = passwordPolicyIssue(password);
  return issue ? PASSWORD_POLICY_MESSAGES[issue] : null;
}

export const SUPER_ADMIN_TOKEN_AUDIENCE = 'sunday-school-super-admin';
export const SUPER_ADMIN_TOKEN_ISSUER = 'sunday-school-platform-control-plane';
export const SUPER_ADMIN_ACCESS_EXPIRY_SECONDS = 900; // 15 minutes
export const SUPER_ADMIN_REFRESH_EXPIRY_DAYS = 7;

export const SUPER_ADMIN_COOKIE_ACCESS = 'super_admin_access_token';
export const SUPER_ADMIN_COOKIE_REFRESH = 'super_admin_refresh_token';
export const SUPER_ADMIN_COOKIE_SESSION = 'super_admin_session';

export interface SuperAdminSessionPayload {
  sub: string;
  role: 'super_admin';
  typ: 'super_admin_access';
  sessionId: string;
}

export class SuperAdminError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'SUPER_ADMIN_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Durable brute-force protection. The in-memory limiter in security.ts is
// per-instance only; this failure window is shared through the platform DB so
// it also holds across serverless instances.
// ---------------------------------------------------------------------------

export const SUPER_ADMIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;
export const SUPER_ADMIN_MAX_FAILED_ATTEMPTS = 5;

export type SuperAdminAuthAction = 'setup' | 'login';

export async function checkSuperAdminAttemptLimit(
  action: SuperAdminAuthAction,
  ip: string | null,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const ipHash = hashIp(ip) ?? 'unknown';
  const row = await platformQueryOne<{ count: number; oldest: string | Date | null }>(
    `SELECT COUNT(*)::int AS "count", MIN("createdAt") AS "oldest"
     FROM "super_admin_auth_attempts"
     WHERE "action" = $1
       AND "ipHash" = $2
       AND "success" = false
       AND "createdAt" > now() - make_interval(secs => $3)`,
    [action, ipHash, SUPER_ADMIN_ATTEMPT_WINDOW_SECONDS],
  );

  if ((row?.count ?? 0) >= SUPER_ADMIN_MAX_FAILED_ATTEMPTS) {
    const oldest = row?.oldest ? new Date(row.oldest).getTime() : Date.now();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + SUPER_ADMIN_ATTEMPT_WINDOW_SECONDS * 1000 - Date.now()) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordSuperAdminFailedAttempt(
  action: SuperAdminAuthAction,
  ip: string | null,
): Promise<void> {
  const ipHash = hashIp(ip) ?? 'unknown';
  await platformQuery(
    `INSERT INTO "super_admin_auth_attempts" ("ipHash", "action", "success", "createdAt")
     VALUES ($1, $2, false, now())`,
    [ipHash, action],
  );
  // Opportunistic cleanup keeps the table small without a scheduled job.
  await platformQuery(
    `DELETE FROM "super_admin_auth_attempts" WHERE "createdAt" < now() - interval '1 day'`,
  ).catch(() => undefined);
}

export async function clearSuperAdminFailedAttempts(
  action: SuperAdminAuthAction,
  ip: string | null,
): Promise<void> {
  const ipHash = hashIp(ip) ?? 'unknown';
  await platformQuery(
    `DELETE FROM "super_admin_auth_attempts" WHERE "action" = $1 AND "ipHash" = $2 AND "success" = false`,
    [action, ipHash],
  );
}

/** Check if the initial Super Admin setup has already been completed. */
export async function isSuperAdminSetupCompleted(): Promise<boolean> {
  const row = await platformQueryOne<{ id: string }>(
    `SELECT "id" FROM "super_admin_credentials" WHERE "isSingleton" = true LIMIT 1`,
  );
  return Boolean(row?.id);
}

/**
 * Perform initial setup of the Super Admin master password.
 * Protected against concurrency via database singleton unique constraint.
 * Only stores Argon2id hash.
 */
export async function setupSuperAdmin(
  password: unknown,
  confirmPassword: unknown,
  ip?: string | null,
): Promise<{ success: boolean }> {
  if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
    throw new SuperAdminError('كلمة المرور وتأكيد كلمة المرور مطلوبان.', 400, 'INVALID_INPUT');
  }

  if (password !== confirmPassword) {
    throw new SuperAdminError('كلمتا المرور غير متطابقتين.', 400, 'PASSWORDS_DO_NOT_MATCH');
  }

  const strengthIssue = validateSuperAdminPassword(password);
  if (strengthIssue) {
    throw new SuperAdminError(strengthIssue, 400, 'PASSWORD_TOO_WEAK');
  }

  const alreadyCompleted = await isSuperAdminSetupCompleted();
  if (alreadyCompleted) {
    throw new SuperAdminError(
      'تم إعداد حساب المدير العام مسبقاً. لا يمكن تكرار الإعداد الأولي.',
      409,
      'SETUP_ALREADY_COMPLETED',
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  try {
    await platformQuery(
      `INSERT INTO "super_admin_credentials"
         ("id", "isSingleton", "passwordHash", "setupCompletedAt", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), true, $1, now(), now(), now())`,
      [passwordHash],
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      throw new SuperAdminError(
        'تم إعداد حساب المدير العام مسبقاً.',
        409,
        'SETUP_ALREADY_COMPLETED',
      );
    }
    throw err;
  }

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: 'super_admin.initial_setup',
    entityType: 'super_admin',
    ip: ip ?? null,
    after: { completed: true },
  });

  return { success: true };
}

/** Authenticate master password using Argon2id verification. */
export async function authenticateSuperAdminPassword(password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password) {
    return false;
  }

  const record = await platformQueryOne<{ id: string; passwordHash: string }>(
    `SELECT "id", "passwordHash" FROM "super_admin_credentials" WHERE "isSingleton" = true LIMIT 1`,
  );

  if (!record || !record.passwordHash) {
    return false;
  }

  try {
    const isValid = await argon2.verify(record.passwordHash, password);
    if (isValid) {
      await platformQuery(
        `UPDATE "super_admin_credentials" SET "lastLoginAt" = now(), "updatedAt" = now() WHERE "id" = $1`,
        [record.id],
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Issue cryptographically signed access token for Super Admin. */
export async function signSuperAdminAccessToken(sessionId: string): Promise<string> {
  return new SignJWT({
    sub: 'super-admin',
    role: 'super_admin',
    typ: 'super_admin_access',
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SUPER_ADMIN_TOKEN_ISSUER)
    .setAudience(SUPER_ADMIN_TOKEN_AUDIENCE)
    .setSubject('super-admin')
    .setIssuedAt()
    .setExpirationTime(`${SUPER_ADMIN_ACCESS_EXPIRY_SECONDS}s`)
    .sign(getPlatformJwtSecret());
}

/** Verify a Super Admin JWT access token. */
export async function verifySuperAdminAccessToken(
  token: string,
): Promise<SuperAdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPlatformJwtSecret(), {
      issuer: SUPER_ADMIN_TOKEN_ISSUER,
      audience: SUPER_ADMIN_TOKEN_AUDIENCE,
    });

    if (
      payload.sub !== 'super-admin' ||
      payload.role !== 'super_admin' ||
      payload.typ !== 'super_admin_access' ||
      typeof payload.sessionId !== 'string'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      role: 'super_admin',
      typ: 'super_admin_access',
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * Confirm the database session backing an access token is still active.
 * This makes logout/revocation effective immediately instead of waiting for the
 * short-lived JWT to expire.
 */
export async function isSuperAdminAccessSessionActive(accessToken: string): Promise<boolean> {
  const row = await platformQueryOne<{ id: string }>(
    `SELECT "id" FROM "super_admin_sessions"
     WHERE "sessionTokenHash" = $1
       AND "revokedAt" IS NULL
       AND "expiresAt" > now()
     LIMIT 1`,
    [sha256Hex(accessToken)],
  );
  return Boolean(row?.id);
}

/**
 * Issue a complete Super Admin session with access token and refresh token,
 * recorded in database.
 */
export async function issueSuperAdminSession(meta: {
  ip?: string | null;
  userAgent?: string | null;
} = {}): Promise<{
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const sessionId = randomBytes(16).toString('hex');
  const accessToken = await signSuperAdminAccessToken(sessionId);

  const rawRefreshToken = randomBytes(48).toString('base64url');
  const sessionTokenHash = sha256Hex(accessToken);
  const refreshTokenHash = sha256Hex(rawRefreshToken);
  const expiresAt = new Date(Date.now() + SUPER_ADMIN_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const ipHash = meta.ip ? hashIp(meta.ip) : null;
  const userAgentHash = meta.userAgent ? sha256Hex(meta.userAgent) : null;

  await platformQuery(
    `INSERT INTO "super_admin_sessions"
       ("id", "sessionTokenHash", "refreshTokenHash", "ipHash", "userAgentHash", "expiresAt", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), now())`,
    [sessionTokenHash, refreshTokenHash, ipHash, userAgentHash, expiresAt],
  );

  return {
    sessionId,
    accessToken,
    refreshToken: rawRefreshToken,
    expiresAt,
  };
}

/** Rotate and refresh Super Admin session using refresh token. */
export async function refreshSuperAdminSession(
  rawRefreshToken: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} | null> {
  const oldHash = sha256Hex(rawRefreshToken);

  // Atomic one-time rotation: only the first concurrent request can revoke the
  // old refresh token and obtain a replacement session.
  const session = await platformQueryOne<{ id: string }>(
    `UPDATE "super_admin_sessions"
     SET "revokedAt" = now(), "updatedAt" = now()
     WHERE "refreshTokenHash" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()
     RETURNING "id"`,
    [oldHash],
  );

  if (!session) {
    return null;
  }

  const newSession = await issueSuperAdminSession(meta);
  return {
    accessToken: newSession.accessToken,
    refreshToken: newSession.refreshToken,
    expiresAt: newSession.expiresAt,
  };
}

/** Revoke a Super Admin session on logout (refresh token and/or access token). */
export async function revokeSuperAdminSession(
  rawRefreshToken?: string | null,
  rawAccessToken?: string | null,
): Promise<void> {
  const hashes = [rawRefreshToken, rawAccessToken]
    .filter((token): token is string => Boolean(token))
    .map((token) => sha256Hex(token));
  if (hashes.length === 0) return;

  await platformQuery(
    `UPDATE "super_admin_sessions" SET "revokedAt" = now(), "updatedAt" = now()
     WHERE ("refreshTokenHash" = ANY($1::text[]) OR "sessionTokenHash" = ANY($1::text[]))
       AND "revokedAt" IS NULL`,
    [hashes],
  );
}

/** Revoke all active Super Admin sessions. */
export async function revokeAllSuperAdminSessions(): Promise<void> {
  await platformQuery(
    `UPDATE "super_admin_sessions" SET "revokedAt" = now(), "updatedAt" = now()
     WHERE "revokedAt" IS NULL`,
  );
}

// ---------------------------------------------------------------------------
// Cookie Options (HttpOnly, Secure in production, SameSite strict/lax)
// ---------------------------------------------------------------------------

export function superAdminAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SUPER_ADMIN_ACCESS_EXPIRY_SECONDS,
  };
}

export function superAdminRefreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict' as const,
    path: '/',
    expires: expiresAt,
  };
}

export function superAdminSessionCookieOptions() {
  return {
    // Presence-only flag for proxy routing. It is HttpOnly because the client
    // never needs to read it; the real tokens are always HttpOnly.
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SUPER_ADMIN_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
  };
}

export function clearSuperAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}
