import { generateChurchCode } from '../platform/churches.ts';
import { platformQuery, platformTransaction } from '../platform/db.ts';
import { recordPlatformAudit } from '../platform/audit.ts';

export interface ChurchJoinCodeRecord {
  churchId: string;
  churchName: string;
  churchSlug: string;
  churchStatus: string;
  purpose: ChurchCodePurpose;
  code: string | null;
  expiresAt: Date | null;
  createdAt: Date | null;
  isExpired: boolean;
}

export type ChurchCodePurpose = 'join' | 'admin' | 'priest';

export async function listChurchJoinCodes(): Promise<ChurchJoinCodeRecord[]> {
  const rows = await platformQuery<Omit<ChurchJoinCodeRecord, 'isExpired'>>(
    `SELECT c."id" AS "churchId", c."name" AS "churchName",
            c."slug" AS "churchSlug", c."status" AS "churchStatus",
            purposes."purpose", cc."code", cc."expiresAt", cc."createdAt"
     FROM "churches" c
     CROSS JOIN (VALUES ('join'), ('admin'), ('priest')) AS purposes("purpose")
     LEFT JOIN LATERAL (
       SELECT "code", "expiresAt", "createdAt"
       FROM "church_codes"
       WHERE "churchId" = c."id"
         AND "purpose" = purposes."purpose"
         AND "revoked" = false
       ORDER BY "createdAt" DESC
       LIMIT 1
     ) cc ON true
     WHERE c."status" <> 'archived'
     ORDER BY c."name", c."id", purposes."purpose"`,
  );

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    isExpired: Boolean(row.expiresAt && new Date(row.expiresAt).getTime() <= now),
  }));
}

export async function rotateChurchJoinCode(
  churchId: string,
  ip?: string | null,
  purpose: ChurchCodePurpose = 'join',
): Promise<string | null> {
  const code = generateChurchCode();
  const [, , insertedRows] = await platformTransaction<{ id: string; code: string }>([
    {
      text: `SELECT "id" FROM "churches"
             WHERE "id" = $1 AND "status" <> 'archived'
             FOR UPDATE`,
      params: [churchId],
    },
    {
      text: `UPDATE "church_codes"
             SET "revoked" = true, "updatedAt" = now()
             WHERE "churchId" = $1 AND "purpose" = $2 AND "revoked" = false
               AND EXISTS (
                 SELECT 1 FROM "churches" c
                 WHERE c."id" = $1 AND c."status" <> 'archived'
               )`,
      params: [churchId, purpose],
    },
    {
      text: `INSERT INTO "church_codes"
               ("id", "churchId", "code", "purpose", "revoked", "createdAt", "updatedAt")
             SELECT uuid_generate_v4(), c."id", $3, $2, false, now(), now()
             FROM "churches" c
             WHERE c."id" = $1 AND c."status" <> 'archived'
             RETURNING "id", "code"`,
      params: [churchId, purpose, code],
    },
  ]);
  const inserted = insertedRows?.[0];
  if (!inserted) return null;

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: purpose === 'join' ? 'church_join_code.rotated' : `church_${purpose}_code.rotated`,
    entityType: 'church',
    entityId: churchId,
    ip,
  });
  return inserted.code;
}

export async function revokeChurchJoinCode(
  churchId: string,
  ip?: string | null,
  purpose: ChurchCodePurpose = 'join',
): Promise<boolean> {
  const [rows] = await platformQuery<{ churchId: string }>(
    `UPDATE "church_codes"
     SET "revoked" = true, "updatedAt" = now()
     WHERE "churchId" = $1 AND "purpose" = $2 AND "revoked" = false
       AND EXISTS (
         SELECT 1 FROM "churches" c
         WHERE c."id" = $1 AND c."status" <> 'archived'
       )
     RETURNING "churchId"`,
    [churchId, purpose],
  );
  if (!rows) return false;

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: purpose === 'join' ? 'church_join_code.revoked' : `church_${purpose}_code.revoked`,
    entityType: 'church',
    entityId: churchId,
    ip,
  });
  return true;
}
