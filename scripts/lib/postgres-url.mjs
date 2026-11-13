/**
 * Small, dependency-free PostgreSQL URL helpers for maintenance scripts.
 * They never print or return credentials.
 */
import { createHash } from 'node:crypto';

export function parsePostgresUrl(value, label = 'database URL') {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${label} must be a PostgreSQL connection string`);
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error(`${label} must include a host and database name`);
  }
  return parsed;
}

/**
 * Neon exposes pooled and direct endpoints on different hostnames, so the
 * `-pooler` label is ignored when identifying the underlying database.
 */
export function databaseIdentity(value) {
  const parsed = parsePostgresUrl(value);
  const host = parsed.hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
  const port = parsed.port || '5432';
  const database = parsed.pathname.replace(/^\/+/, '').toLowerCase();
  return `${host}:${port}/${database}`;
}

export function isSamePostgresDatabase(left, right) {
  return databaseIdentity(left) === databaseIdentity(right);
}

/** Must match src/server/platform/crypto.ts#fingerprintConnectionUrl. */
export function fingerprintConnectionUrl(value) {
  const parsed = parsePostgresUrl(value);
  return createHash('sha256')
    .update(`${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`)
    .digest('hex');
}
