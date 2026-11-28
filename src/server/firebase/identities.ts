import { query, queryOne } from '../db';

/**
 * Maps a Firebase Authentication UID to the tenant user row.
 *
 * The link lives in the tenant database (`users.firebaseUid`), next to the role
 * and class scope it belongs to. No identity copy is kept inside Firebase: it
 * only proves the credential, and Postgres stays the single source of truth for
 * who the user is and what they may do.
 *
 * Must run inside the tenant context established by `withResolvedTenant`, so one
 * church can never read another church's identity links.
 */

export async function findFirebaseUserId(uid: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT "id" FROM "users" WHERE "firebaseUid" = $1 LIMIT 1`,
    [uid],
  );
  return row?.id ?? null;
}

/** Link a verified Firebase credential to an existing tenant user. */
export async function linkFirebaseUser(userId: string, uid: string): Promise<void> {
  await query(
    `UPDATE "users" SET "firebaseUid" = $2, "updatedAt" = now()
     WHERE "id" = $1 AND "firebaseUid" IS NULL`,
    [userId, uid],
  );
}
