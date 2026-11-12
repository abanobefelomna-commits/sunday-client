import { platformQuery } from './db';
import { hashIp } from './crypto';

const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'encryptedUrl',
  'connectionString',
  'databaseUrl',
  'secret',
  'apiKey',
  'authorization',
]);

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) {
        result[key] = '[redacted]';
      } else {
        result[key] = sanitizeAuditValue(item, depth + 1);
      }
    }
    return result;
  }
  return String(value);
}

export async function recordPlatformAudit(input: {
  actorId?: string | null;
  actorType?: 'platform_admin' | 'system' | 'public' | 'cron';
  action: string;
  entityType: string;
  entityId?: string | null;
  ip?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await platformQuery(
      `INSERT INTO "platform_audit_logs"
         ("id", "actorId", "actorType", "action", "entityType", "entityId", "ipHash", "before", "after", "createdAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())`,
      [
        input.actorId ?? null,
        input.actorType ?? 'platform_admin',
        input.action.slice(0, 80),
        input.entityType.slice(0, 60),
        input.entityId ?? null,
        hashIp(input.ip ?? null),
        input.before === undefined ? null : JSON.stringify(sanitizeAuditValue(input.before)),
        input.after === undefined ? null : JSON.stringify(sanitizeAuditValue(input.after)),
      ],
    );
  } catch (error) {
    console.error('[platform-audit] Insert failed:', (error as Error).message);
  }
}

export function sanitizeErrorMessage(error: unknown): { code: string; message: string } {
  const rawCode =
    (error as { code?: unknown })?.code && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'PROVISIONING_ERROR';
  let message = error instanceof Error ? error.message : 'Provisioning failed';
  message = message
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted-connection]')
    .replace(/password=[^\s&]+/gi, 'password=[redacted]')
    .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]')
    .slice(0, 500);
  return { code: rawCode.slice(0, 80), message };
}
