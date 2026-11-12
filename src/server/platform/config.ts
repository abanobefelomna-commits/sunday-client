/**
 * Platform-wide configuration helpers.
 *
 * No secret is ever hard-coded. Missing production secrets fail closed when the
 * relevant feature is used, while development falls back to process-local
 * values so the app remains runnable without committing credentials.
 */
import { createHash, randomBytes } from 'node:crypto';

const warned = new Set<string>();
let ephemeralJwtSecret: Buffer | null = null;

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[config] ${message}`);
}

export function getJwtSecret(): Buffer {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) {
    return Buffer.from(configured, 'utf8');
  }
  if (configured && configured.length > 0 && !isProduction()) {
    warnOnce('jwt-short', 'JWT_SECRET is shorter than 32 characters; use a stronger secret.');
    return Buffer.from(configured, 'utf8');
  }
  if (isProduction()) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }
  if (!ephemeralJwtSecret) {
    ephemeralJwtSecret = randomBytes(48);
    warnOnce(
      'jwt-ephemeral',
      'JWT_SECRET is not set; using an ephemeral development secret. Sessions reset on restart.',
    );
  }
  return ephemeralJwtSecret;
}

export function getPlatformJwtSecret(): Buffer {
  const configured = process.env.PLATFORM_JWT_SECRET;
  if (configured && configured.length >= 32) {
    return Buffer.from(configured, 'utf8');
  }
  if (configured && configured.length > 0 && !isProduction()) {
    warnOnce('platform-jwt-short', 'PLATFORM_JWT_SECRET is short; use 32+ random characters.');
    return Buffer.from(configured, 'utf8');
  }
  if (isProduction()) {
    throw new Error('PLATFORM_JWT_SECRET must be set in production');
  }
  // Domain-separated fallback keeps dev simple without reusing the exact key.
  return createHash('sha256').update(getJwtSecret()).update('platform-admin-v1').digest();
}

export function getOtpSecret(): Buffer {
  const configured = process.env.OTP_SECRET;
  if (configured && configured.length >= 32) {
    return Buffer.from(configured, 'utf8');
  }
  if (configured && configured.length > 0 && !isProduction()) {
    warnOnce('otp-short', 'OTP_SECRET is shorter than 32 characters; use a stronger secret.');
    return Buffer.from(configured, 'utf8');
  }
  if (isProduction()) {
    throw new Error('OTP_SECRET must be set to a strong value in production');
  }
  warnOnce(
    'otp-derived',
    'OTP_SECRET is not set; deriving a development secret from JWT_SECRET.',
  );
  return createHash('sha256').update(getJwtSecret()).update('otp-codes-v1').digest();
}

export function getTenantEncryptionKey(): Buffer {
  const configured = process.env.TENANT_SECRET_KEY;
  if (configured) {
    const trimmed = configured.trim();
    if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
    if (trimmed.length >= 32) {
      warnOnce('tenant-key-derived', 'TENANT_SECRET_KEY is not 32-byte base64/hex; deriving a key with SHA-256.');
      return createHash('sha256').update(trimmed).digest();
    }
  }
  if (isProduction()) {
    throw new Error('TENANT_SECRET_KEY must be configured in production');
  }
  warnOnce(
    'tenant-key-dev',
    'TENANT_SECRET_KEY is not set; deriving a development key. Set a random 32-byte key before storing tenant URLs.',
  );
  return createHash('sha256').update(getJwtSecret()).update('tenant-connections-v1').digest();
}

export function getPlatformDatabaseUrl(): string {
  const configured = process.env.PLATFORM_DATABASE_URL;
  if (configured) return configured;
  if (isProduction() || process.env.ALLOW_SHARED_PLATFORM_DATABASE === 'true') {
    const fallback = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
    if (fallback) {
      warnOnce(
        'shared-platform-db',
        'PLATFORM_DATABASE_URL is unset; using DATABASE_URL with ALLOW_SHARED_PLATFORM_DATABASE. Do not use this in production.',
      );
      return fallback;
    }
  }
  throw new Error('PLATFORM_DATABASE_URL is not configured');
}

export function getPlatformRootDomain(): string | null {
  const raw = (process.env.PLATFORM_ROOT_DOMAIN || '').trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/^\.+|\.+$/g, '');
}

export function getTenantAdminDatabaseUrl(): string {
  const configured =
    process.env.TENANT_ADMIN_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.PLATFORM_DATABASE_URL_UNPOOLED;
  if (configured) return configured;
  if (isProduction()) {
    throw new Error('TENANT_ADMIN_DATABASE_URL is required for database provisioning');
  }
  return process.env.PLATFORM_DATABASE_URL || getPlatformDatabaseUrl();
}

export function getProvisioningProvider(): 'postgres' | 'neon-project' | 'manual' {
  const configured = (process.env.TENANT_PROVISIONING_PROVIDER || '').trim();
  if (configured === 'neon-project' || configured === 'manual' || configured === 'postgres') {
    return configured;
  }
  if (process.env.NEON_API_KEY) return 'neon-project';
  return isProduction() ? 'manual' : 'postgres';
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (isProduction() ? '' : 'http://localhost:3000')
  ).replace(/\/+$/, '');
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 120) || null;
  return req.headers.get('x-real-ip')?.slice(0, 120) || null;
}
