import { generateChurchCode } from '../platform/churches.ts';
import { platformQuery, platformTransaction } from '../platform/db.ts';
import { recordPlatformAudit } from '../platform/audit.ts';

export interface ChurchJoinCodeRecord {
  churchId: string;
  churchName: string;
  churchSlug: string;
  churchStatus: string;
  code: string | null;
  expiresAt: Date | null;
  createdAt: Date | null;
  isExpired: boolean;
}

export async function listChurchJoinCodes(): Promise<ChurchJoinCodeRecord[]> {
  const rows = await platformQuery<Omit<ChurchJoinCodeRecord, 'isExpired'>>(
    `SELECT c."id" AS "churchId", c."name" AS "churchName",
            c."slug" AS "churchSlug", c."status" AS "churchStatus",
            cc."code", cc."expiresAt", cc."createdAt"
     FROM "churches" c
     LEFT JOIN LATERAL (
       SELECT "code", "expiresAt", "createdAt"
       FROM "church_codes"
       WHERE "churchId" = c."id" AND "revoked" = false
       ORDER BY "createdAt" DESC
       LIMIT 1
     ) cc ON true
     WHERE c."status" <> 'archived'
     ORDER BY c."name", c."id"`,
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
             WHERE "churchId" = $1 AND "revoked" = false
               AND EXISTS (
                 SELECT 1 FROM "churches" c
                 WHERE c."id" = $1 AND c."status" <> 'archived'
               )`,
      params: [churchId],
    },
    {
      text: `INSERT INTO "church_codes"
               ("id", "churchId", "code", "revoked", "createdAt", "updatedAt")
             SELECT uuid_generate_v4(), c."id", $2, false, now(), now()
             FROM "churches" c
             WHERE c."id" = $1 AND c."status" <> 'archived'
             RETURNING "id", "code"`,
      params: [churchId, code],
    },
  ]);
  const inserted = insertedRows?.[0];
  if (!inserted) return null;

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: 'church_join_code.rotated',
    entityType: 'church',
    entityId: churchId,
    ip,
  });
  return inserted.code;
}

export async function revokeChurchJoinCode(
  churchId: string,
  ip?: string | null,
): Promise<boolean> {
  const [rows] = await platformQuery<{ churchId: string }>(
    `UPDATE "church_codes"
     SET "revoked" = true, "updatedAt" = now()
     WHERE "churchId" = $1 AND "revoked" = false
       AND EXISTS (
         SELECT 1 FROM "churches" c
         WHERE c."id" = $1 AND c."status" <> 'archived'
       )
     RETURNING "churchId"`,
    [churchId],
  );
  if (!rows) return false;

  await recordPlatformAudit({
    actorType: 'platform_admin',
    action: 'church_join_code.revoked',
    entityType: 'church',
    entityId: churchId,
    ip,
  });
  return true;
}
