import { randomBytes, randomUUID } from 'node:crypto';
import { platformQuery, platformQueryOne } from '../platform/db.ts';
import { sha256Hex } from '../platform/crypto.ts';
import { recordPlatformAudit } from '../platform/audit.ts';

export interface CreationCodeRecord {
  id: string;
  codePrefix: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  status: 'active' | 'revoked' | 'expired' | 'depleted';
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedCreationCode {
  id: string;
  code: string;
  codePrefix: string;
  expiresAt: Date | null;
  maxUses: number;
  note: string | null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate high-entropy church creation code (e.g. CC-7X9K-3M2P-8W4Q). */
export function generateRawCreationCode(): string {
  const bytes = randomBytes(12);
  let result = '';
  for (let i = 0; i < 12; i += 1) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `CC-${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
}

export function normalizeCreationCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashCreationCode(code: string): string {
  return sha256Hex(normalizeCreationCode(code));
}

/**
 * Generate a new church creation code.
 * The raw code is returned ONLY ONCE upon creation so the Super Admin can copy it.
 * The database stores only the SHA-256 hash and a non-sensitive prefix.
 */
export async function createChurchCreationCode(options: {
  note?: string | null;
  maxUses?: number;
  expiresInDays?: number | null;
  ip?: string | null;
}): Promise<GeneratedCreationCode> {
  const rawCode = generateRawCreationCode();
  const codeHash = hashCreationCode(rawCode);
  const codePrefix = rawCode.slice(0, 7); // e.g. "CC-7X9K"
  const maxUses = Math.max(1, Math.min(100, Number(options.maxUses || 1)));
  const note = options.note ? options.note.trim().slice(0, 255) : null;

  let expiresAt: Date | null = null;
  if (options.expiresInDays && Number(options.expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(options.expiresInDays) * 24 * 60 * 60 * 1000);
  }

  const id = randomUUID();

  await platformQuery(
    `INSERT INTO "church_creation_codes"
       ("id", "codeHash", "codePrefix", "note", "maxUses", "usedCount", "status", "expiresAt", "createdBy", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 0, 'active', $6, 'super_admin', now(), now())`,
    [id, codeHash, codePrefix, note, maxUses, expiresAt],
  );

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: 'church_creation_code.created',
    entityType: 'church_creation_code',
    entityId: id,
    ip: options.ip ?? null,
    after: { codePrefix, maxUses, note, expiresAt },
  });

  return {
    id,
    code: rawCode,
    codePrefix,
    expiresAt,
    maxUses,
    note,
  };
}

/**
 * List existing creation codes.
 * NEVER returns the codeHash or the full plaintext code.
 */
export async function listChurchCreationCodes(): Promise<CreationCodeRecord[]> {
  const rows = await platformQuery<CreationCodeRecord>(
    `SELECT "id", "codePrefix", "note", "maxUses", "usedCount", "status", "expiresAt", "revokedAt", "lastUsedAt", "createdAt", "updatedAt"
     FROM "church_creation_codes"
     ORDER BY "createdAt" DESC`,
  );

  // Automatically update status to 'expired' if expiration date has passed
  const now = new Date();
  return rows.map((row) => {
    if (row.status === 'active' && row.expiresAt && new Date(row.expiresAt) <= now) {
      return { ...row, status: 'expired' };
    }
    return row;
  });
}

/**
 * Revoke a church creation code immediately.
 */
export async function revokeChurchCreationCode(codeId: string, ip?: string | null): Promise<boolean> {
  const updated = await platformQueryOne<{ id: string }>(
    `UPDATE "church_creation_codes"
     SET "status" = 'revoked', "revokedAt" = now(), "updatedAt" = now()
     WHERE "id" = $1 AND "status" <> 'revoked'
     RETURNING "id"`,
    [codeId],
  );

  if (updated) {
    await recordPlatformAudit({
      actorType: 'platform_admin',
      action: 'church_creation_code.revoked',
      entityType: 'church_creation_code',
      entityId: codeId,
      ip: ip ?? null,
    });
    return true;
  }
  return false;
}

/**
 * Rotate a church creation code:
 * Revokes the old code and generates a replacement with identical note & maxUses.
 */
export async function rotateChurchCreationCode(
  codeId: string,
  ip?: string | null,
): Promise<GeneratedCreationCode | null> {
  const oldCode = await platformQueryOne<CreationCodeRecord>(
    `SELECT * FROM "church_creation_codes" WHERE "id" = $1 LIMIT 1`,
    [codeId],
  );

  if (!oldCode) return null;

  // Revoke old code
  await revokeChurchCreationCode(codeId, ip);

  // Create new code with same attributes
  const newCode = await createChurchCreationCode({
    note: oldCode.note,
    maxUses: oldCode.maxUses,
    expiresInDays: oldCode.expiresAt
      ? Math.max(1, Math.ceil((new Date(oldCode.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null,
    ip,
  });

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: 'church_creation_code.rotated',
    entityType: 'church_creation_code',
    entityId: newCode.id,
    ip: ip ?? null,
    before: { oldCodeId: codeId, oldPrefix: oldCode.codePrefix },
    after: { newCodeId: newCode.id, newPrefix: newCode.codePrefix },
  });

  return newCode;
}

/**
 * Validate and consume a church creation code during church registration.
 * Atomically checks validity and increments used count.
 */
export async function validateAndConsumeCreationCode(
  rawCode: string,
  churchId: string,
  creator: { name: string; email: string },
): Promise<{ codeId: string }> {
  const codeHash = hashCreationCode(rawCode);

  // Atomic conditional update to prevent race conditions
  const result = await platformQueryOne<{ id: string; usedCount: number; maxUses: number }>(
    `UPDATE "church_creation_codes"
     SET "usedCount" = "usedCount" + 1,
         "lastUsedAt" = now(),
         "status" = CASE WHEN "usedCount" + 1 >= "maxUses" THEN 'depleted' ELSE 'active' END,
         "updatedAt" = now()
     WHERE "codeHash" = $1
       AND "status" = 'active'
       AND "revokedAt" IS NULL
       AND ("expiresAt" IS NULL OR "expiresAt" > now())
       AND "usedCount" < "maxUses"
     RETURNING "id", "usedCount", "maxUses"`,
    [codeHash],
  );

  if (!result) {
    const error = new Error('رمز إنشاء الكنيسة غير صالح أو منتهي الصلاحية أو تم استنفاذ مرات استخدامه.');
    (error as Error & { status: number; code: string }).status = 403;
    (error as Error & { status: number; code: string }).code = 'INVALID_CREATION_CODE';
    throw error;
  }

  // Associate church with code and creator
  await platformQuery(
    `UPDATE "churches"
     SET "creationCodeId" = $1,
         "creatorName" = $2,
         "creatorEmail" = $3,
         "updatedAt" = now()
     WHERE "id" = $4`,
    [result.id, creator.name, creator.email.toLowerCase(), churchId],
  );

  return { codeId: result.id };
}
