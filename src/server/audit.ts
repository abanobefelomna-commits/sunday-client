import { query } from './db';

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Append-only audit trail for sensitive student/care modifications.
 * Never throws into the main request flow: a failed audit insert is logged but
 * does not roll back the user's successful operation.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO "audit_logs"
         ("id", "actorId", "action", "entityType", "entityId", "before", "after", "ip", "createdAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, now())`,
      [
        input.actorId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.before === undefined ? null : JSON.stringify(input.before),
        input.after === undefined ? null : JSON.stringify(input.after),
        input.ip ?? null,
      ],
    );
  } catch (error) {
    console.error('Audit log insert failed:', error);
  }
}

export function requestIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 80) || null;
  return req.headers.get('x-real-ip')?.slice(0, 80) || null;
}
