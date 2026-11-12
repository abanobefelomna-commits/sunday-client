import { platformQueryOne } from '../platform/db';
import { decryptSecret } from '../platform/crypto';
import {
  getPlatformRootDomain,
  isProduction,
} from '../platform/config';
import type { TenantContext } from './context';

interface ChurchConnectionRow {
  id: string;
  slug: string;
  name: string;
  status: TenantContext['status'];
  verificationStatus: string;
  isLifetimeFree: boolean;
  primaryDomain: string | null;
  customDomain: string | null;
  settings: Record<string, unknown> | null;
  encryptedUrl: string;
  databaseName: string | null;
  databaseHost: string | null;
}

export type TenantResolution =
  | { ok: true; tenant: TenantContext }
  | { ok: false; status: number; code: string; message: string };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { tenant: TenantContext; expiresAt: number }>();

export function invalidateTenantCache(churchId?: string): void {
  if (!churchId) {
    cache.clear();
    return;
  }
  for (const [key, value] of cache.entries()) {
    if (key.includes(churchId) || value.tenant.churchId === churchId) cache.delete(key);
  }
}

function normalizeHost(raw: string | null): string | null {
  if (!raw) return null;
  let host = raw.split(',')[0]?.trim().toLowerCase() || '';
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host || host.includes('/') || host.includes(' ') || host.length > 253) return null;
  return host;
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function timezoneFromSettings(settings: Record<string, unknown> | null): string {
  const value = settings?.timezone;
  return typeof value === 'string' && value.length <= 60 ? value : 'Africa/Cairo';
}

function toTenant(row: ChurchConnectionRow): TenantContext {
  return {
    churchId: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    verificationStatus: row.verificationStatus,
    isLifetimeFree: row.isLifetimeFree,
    connectionString: decryptSecret(row.encryptedUrl),
    databaseName: row.databaseName,
    databaseHost: row.databaseHost,
    timezone: timezoneFromSettings(row.settings),
  };
}

const SELECT_COLUMNS = `
  c."id", c."slug", c."name", c."status", c."verificationStatus",
  c."isLifetimeFree", c."primaryDomain", c."customDomain", c."settings",
  tc."encryptedUrl", tc."databaseName", tc."databaseHost"
`;

async function verifyTenantIdentity(tenant: TenantContext): Promise<void> {
  try {
    const identity = await import('../db').then(({ queryOne }) =>
      queryOne<{ churchId: string }>('SELECT "churchId" FROM "tenant_identity" LIMIT 1'),
    );
    if (identity && identity.churchId !== tenant.churchId) {
      throw new Error('TENANT_IDENTITY_MISMATCH');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'TENANT_IDENTITY_MISMATCH') throw error;
    // Missing table on a not-yet-migrated legacy tenant is tolerated; mismatch never is.
  }
}

async function loadBySlug(slug: string): Promise<TenantContext | null> {
  const key = `slug:${slug}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const row = await platformQueryOne<ChurchConnectionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM "churches" c
     JOIN "tenant_connections" tc ON tc."churchId" = c."id"
     WHERE c."slug" = $1 AND c."status" <> 'archived'
     LIMIT 1`,
    [slug],
  );
  if (!row) return null;

  const tenant = toTenant(row);
  // Run the identity check inside the tenant's own async context.
  const { runWithTenant } = await import('./context');
  await runWithTenant(tenant, () => verifyTenantIdentity(tenant));
  cache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  return tenant;
}

async function loadByHost(host: string): Promise<TenantContext | null> {
  const key = `host:${host}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const row = await platformQueryOne<ChurchConnectionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM "churches" c
     JOIN "tenant_connections" tc ON tc."churchId" = c."id"
     WHERE (lower(c."primaryDomain") = $1 OR lower(c."customDomain") = $1)
       AND c."status" <> 'archived'
     LIMIT 1`,
    [host],
  );
  if (!row) return null;
  const tenant = toTenant(row);
  const { runWithTenant } = await import('./context');
  await runWithTenant(tenant, () => verifyTenantIdentity(tenant));
  cache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  return tenant;
}

function hostToTenantSlug(host: string): string | null {
  const root = getPlatformRootDomain();
  if (!root) return null;
  if (host === root || host === `www.${root}`) return null;
  if (!host.endsWith(`.${root}`)) return null;
  const prefix = host.slice(0, -(root.length + 1));
  if (!prefix || prefix.includes('.')) return null;
  return prefix;
}

/**
 * Resolve a tenant exclusively from trusted connection metadata (Host header /
 * cookie hint / explicit login selector), never from a client-supplied body
 * `church_id`. The resolved connection is verified against the tenant's own
 * identity table and cached briefly.
 */
export async function resolveTenantRequest(
  request: Request,
  explicitSlug?: string | null,
): Promise<TenantResolution> {
  const host =
    normalizeHost(request.headers.get('x-forwarded-host')) ||
    normalizeHost(request.headers.get('host'));

  const hostSlug = host ? hostToTenantSlug(host) : null;
  const hostTenant = host ? await loadByHost(host) : null;
  const subdomainTenant = !hostTenant && hostSlug ? await loadBySlug(hostSlug) : null;
  const resolvedFromHost = hostTenant || subdomainTenant;

  if (explicitSlug && resolvedFromHost && explicitSlug !== resolvedFromHost.slug) {
    return {
      ok: false,
      status: 403,
      code: 'TENANT_MISMATCH',
      message: 'The selected church does not match this address.',
    };
  }

  if (resolvedFromHost) return { ok: true, tenant: resolvedFromHost };

  const cookieSlug = readCookie(request, 'tenant_slug');
  if (cookieSlug && /^[a-z0-9-]{2,63}$/.test(cookieSlug)) {
    const tenant = await loadBySlug(cookieSlug);
    if (tenant) {
      if (explicitSlug && explicitSlug !== tenant.slug) {
        return {
          ok: false,
          status: 403,
          code: 'TENANT_MISMATCH',
          message: 'The selected church does not match the current session.',
        };
      }
      return { ok: true, tenant };
    }
  }

  if (explicitSlug) {
    const tenant = await loadBySlug(explicitSlug);
    if (tenant) return { ok: true, tenant };
    return {
      ok: false,
      status: 404,
      code: 'TENANT_NOT_FOUND',
      message: 'This church is not registered or is not active.',
    };
  }

  const allowDefault =
    process.env.ALLOW_DEFAULT_TENANT === 'true' || !isProduction();
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG;
  if (allowDefault && defaultSlug) {
    const tenant = await loadBySlug(defaultSlug);
    if (tenant) return { ok: true, tenant };
  }

  return {
    ok: false,
    status: 404,
    code: 'TENANT_REQUIRED',
    message: 'Choose a church to continue.',
  };
}

export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  return loadBySlug(slug);
}

export function tenantCookieOptions(secure: boolean): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  };
}
