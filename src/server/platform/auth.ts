import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { getPlatformJwtSecret } from './config';
import { platformQuery, platformQueryOne } from './db';

export const PLATFORM_TOKEN_AUDIENCE = 'sunday-school-platform-admin';
const PLATFORM_TOKEN_ISSUER = 'sunday-school-platform-control-plane';
const PLATFORM_REFRESH_TTL_DAYS = Number(process.env.PLATFORM_REFRESH_TTL_DAYS || 1);

export type PlatformRole = 'super_admin' | 'operations' | 'support' | 'billing' | 'read_only';

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
}

export type PlatformPermission =
  | 'churches.read'
  | 'churches.write'
  | 'churches.provision'
  | 'churches.lifetime_free'
  | 'settings.read'
  | 'settings.write'
  | 'plans.read'
  | 'plans.write'
  | 'subscriptions.read'
  | 'subscriptions.write'
  | 'audit.read'
  | 'admins.manage';

const ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: [
    'churches.read', 'churches.write', 'churches.provision', 'churches.lifetime_free',
    'settings.read', 'settings.write', 'plans.read', 'plans.write',
    'subscriptions.read', 'subscriptions.write', 'audit.read', 'admins.manage',
  ],
  operations: [
    'churches.read', 'churches.write', 'churches.provision', 'settings.read',
    'plans.read', 'subscriptions.read', 'audit.read',
  ],
  support: ['churches.read', 'settings.read', 'plans.read', 'subscriptions.read', 'audit.read'],
  billing: [
    'churches.read', 'settings.read', 'plans.read', 'plans.write',
    'subscriptions.read', 'subscriptions.write',
  ],
  read_only: ['churches.read', 'settings.read', 'plans.read', 'subscriptions.read', 'audit.read'],
};

export function hasPlatformPermission(
  admin: Pick<PlatformAdmin, 'role'>,
  permission: PlatformPermission,
): boolean {
  return ROLE_PERMISSIONS[admin.role]?.includes(permission) ?? false;
}

export function assertPlatformPermission(
  admin: PlatformAdmin,
  permission: PlatformPermission,
): void {
  if (!hasPlatformPermission(admin, permission)) {
    const error = new Error('Forbidden');
    (error as Error & { status?: number; code?: string }).status = 403;
    (error as Error & { status?: number; code?: string }).code = 'PLATFORM_FORBIDDEN';
    throw error;
  }
}

export async function signPlatformAccessToken(admin: PlatformAdmin): Promise<string> {
  return new SignJWT({
    email: admin.email,
    role: admin.role,
    name: admin.name,
    typ: 'platform',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(PLATFORM_TOKEN_ISSUER)
    .setAudience(PLATFORM_TOKEN_AUDIENCE)
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${Number(process.env.PLATFORM_JWT_EXPIRES_SECONDS || 900)}s`)
    .sign(getPlatformJwtSecret());
}

export async function verifyPlatformAccessToken(
  token: string,
): Promise<{ sub: string; role: PlatformRole; typ: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getPlatformJwtSecret(), {
      issuer: PLATFORM_TOKEN_ISSUER,
      audience: PLATFORM_TOKEN_AUDIENCE,
    });
    if (!payload.sub || payload.typ !== 'platform') return null;
    return {
      sub: payload.sub,
      role: payload.role as PlatformRole,
      typ: 'platform',
    };
  } catch {
    return null;
  }
}

export async function getPlatformAdmin(req: Request): Promise<PlatformAdmin | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const payload = await verifyPlatformAccessToken(token);
  if (!payload) return null;

  const admin = await platformQueryOne<PlatformAdmin>(
    `SELECT "id", "name", "email", "role", "isActive"
     FROM "platform_admins" WHERE "id" = $1 LIMIT 1`,
    [payload.sub],
  );
  if (!admin || !admin.isActive || admin.role !== payload.role) return null;
  return admin;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issuePlatformRefreshToken(
  adminId: string,
  meta: { ipHash?: string | null; userAgentHash?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + PLATFORM_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await platformQuery(
    `INSERT INTO "platform_refresh_tokens"
       ("id", "tokenHash", "adminId", "ipHash", "userAgentHash", "expiresAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now())`,
    [hashToken(token), adminId, meta.ipHash ?? null, meta.userAgentHash ?? null, expiresAt],
  );
  return { token, expiresAt };
}

export async function verifyPlatformRefreshToken(rawToken: string): Promise<PlatformAdmin | null> {
  const row = await platformQueryOne<{ id: string; adminId: string }>(
    `SELECT t."id", t."adminId"
     FROM "platform_refresh_tokens" t
     JOIN "platform_admins" a ON a."id" = t."adminId"
     WHERE t."tokenHash" = $1 AND t."revokedAt" IS NULL AND t."expiresAt" > now()
       AND a."isActive" = true
     LIMIT 1`,
    [hashToken(rawToken)],
  );
  if (!row) return null;
  await platformQuery(
    `UPDATE "platform_refresh_tokens" SET "revokedAt" = now() WHERE "id" = $1`,
    [row.id],
  );
  return platformQueryOne<PlatformAdmin>(
    `SELECT "id", "name", "email", "role", "isActive" FROM "platform_admins" WHERE "id" = $1`,
    [row.adminId],
  );
}

export async function revokePlatformRefreshToken(rawToken?: string | null): Promise<void> {
  if (!rawToken) return;
  await platformQuery(
    `UPDATE "platform_refresh_tokens" SET "revokedAt" = now() WHERE "tokenHash" = $1`,
    [hashToken(rawToken)],
  );
}

export async function revokeAllPlatformRefreshTokens(adminId: string): Promise<void> {
  await platformQuery(
    `UPDATE "platform_refresh_tokens" SET "revokedAt" = now()
     WHERE "adminId" = $1 AND "revokedAt" IS NULL`,
    [adminId],
  );
}

export function platformRefreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/platform/auth',
    expires: expiresAt,
  };
}
