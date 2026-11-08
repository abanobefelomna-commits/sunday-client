import { query, queryOne } from './db';
import type { AccessContext } from './middleware';
import { canReadClass, canWriteClass } from './middleware';

export async function loadChildScope(childId: string, access: AccessContext) {
  const child = await queryOne<{ id: string; name: string; classId: string | null }>(
    `SELECT "id", "name", "classId" FROM "children"
     WHERE "id" = $1 AND "deletedAt" IS NULL LIMIT 1`,
    [childId],
  );
  if (!child) return { error: 'not_found' as const };
  if (!canReadClass(access, child.classId)) return { error: 'forbidden' as const };
  return { child, canWrite: canWriteClass(access, child.classId) };
}

export async function listStudentNotes(childId: string, access: AccessContext) {
  return query<{
    id: string;
    visibility: string;
    body: string;
    authorId: string | null;
    authorName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT n."id", n."visibility", n."body", n."authorId",
            u."name" AS "authorName", n."createdAt", n."updatedAt"
     FROM "student_notes" n
     LEFT JOIN "users" u ON u."id" = n."authorId"
     WHERE n."childId" = $1 AND n."deletedAt" IS NULL
       AND (
         $2::boolean = true
         OR n."visibility" = 'class'
         OR (n."visibility" = 'private' AND n."authorId" = $3)
       )
     ORDER BY n."createdAt" DESC`,
    [childId, access.privileged, access.userId],
  );
}

export async function createStudentNote(
  childId: string,
  access: AccessContext,
  input: { body: string; visibility: string },
) {
  if (input.visibility === 'leaders' && !access.privileged) {
    return { error: 'forbidden' as const };
  }
  const row = await queryOne<{
    id: string;
    visibility: string;
    body: string;
    authorId: string | null;
    createdAt: Date;
  }>(
    `INSERT INTO "student_notes"
       ("id", "childId", "authorId", "visibility", "body", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, now(), now())
     RETURNING "id", "visibility", "body", "authorId", "createdAt"`,
    [childId, access.userId, input.visibility, input.body],
  );
  return { note: row };
}

export async function updateStudentNote(
  childId: string,
  noteId: string,
  access: AccessContext,
  input: { body?: string; visibility?: string },
) {
  const existing = await queryOne<{
    id: string;
    authorId: string | null;
    visibility: string;
    body: string;
  }>(
    `SELECT "id", "authorId", "visibility", "body" FROM "student_notes"
     WHERE "id" = $1 AND "childId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
    [noteId, childId],
  );
  if (!existing) return { error: 'not_found' as const };
  if (!access.privileged && existing.authorId !== access.userId) {
    return { error: 'forbidden' as const };
  }
  if (input.visibility === 'leaders' && !access.privileged) {
    return { error: 'forbidden' as const };
  }

  const row = await queryOne<{
    id: string;
    visibility: string;
    body: string;
    authorId: string | null;
    updatedAt: Date;
  }>(
    `UPDATE "student_notes"
     SET "body" = COALESCE($1, "body"),
         "visibility" = COALESCE($2, "visibility"),
         "updatedAt" = now()
     WHERE "id" = $3 AND "childId" = $4 AND "deletedAt" IS NULL
     RETURNING "id", "visibility", "body", "authorId", "updatedAt"`,
    [input.body ?? null, input.visibility ?? null, noteId, childId],
  );
  return { note: row };
}

export async function deleteStudentNote(
  childId: string,
  noteId: string,
  access: AccessContext,
) {
  const existing = await queryOne<{ id: string; authorId: string | null }>(
    `SELECT "id", "authorId" FROM "student_notes"
     WHERE "id" = $1 AND "childId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
    [noteId, childId],
  );
  if (!existing) return { error: 'not_found' as const };
  if (!access.privileged && existing.authorId !== access.userId) {
    return { error: 'forbidden' as const };
  }
  await query(
    `UPDATE "student_notes" SET "deletedAt" = now(), "updatedAt" = now()
     WHERE "id" = $1 AND "childId" = $2`,
    [noteId, childId],
  );
  return { ok: true as const };
}

export async function listEducationalProgress(childId: string) {
  return query<{
    id: string;
    subject: string;
    level: string;
    score: string | null;
    notes: string | null;
    assessedAt: string;
    assessorName: string | null;
    createdAt: Date;
  }>(
    `SELECT ep."id", ep."subject", ep."level", ep."score", ep."notes",
            ep."assessedAt"::text AS "assessedAt", u."name" AS "assessorName", ep."createdAt"
     FROM "educational_progress" ep
     LEFT JOIN "users" u ON u."id" = ep."assessedBy"
     WHERE ep."childId" = $1
     ORDER BY ep."assessedAt" DESC, ep."createdAt" DESC
     LIMIT 100`,
    [childId],
  );
}

export async function createEducationalProgress(
  childId: string,
  access: AccessContext,
  input: {
    subject: string;
    level: string;
    score: number | null;
    notes: string | null;
    assessedAt: string;
  },
) {
  return queryOne<{
    id: string;
    subject: string;
    level: string;
    score: string | null;
    notes: string | null;
    assessedAt: string;
  }>(
    `INSERT INTO "educational_progress"
       ("id", "childId", "subject", "level", "score", "notes", "assessedBy", "assessedAt", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7::date, now(), now())
     RETURNING "id", "subject", "level", "score", "notes", "assessedAt"::text AS "assessedAt"`,
    [childId, input.subject, input.level, input.score, input.notes, access.userId, input.assessedAt],
  );
}

export async function updateEducationalProgress(
  childId: string,
  progressId: string,
  access: AccessContext,
  input: {
    subject?: string;
    level?: string;
    score?: number | null;
    notes?: string | null;
    assessedAt?: string;
  },
) {
  const existing = await queryOne<{ id: string }>(
    `SELECT "id" FROM "educational_progress" WHERE "id" = $1 AND "childId" = $2 LIMIT 1`,
    [progressId, childId],
  );
  if (!existing) return { error: 'not_found' as const };

  const row = await queryOne<{
    id: string;
    subject: string;
    level: string;
    score: string | null;
    notes: string | null;
    assessedAt: string;
  }>(
    `UPDATE "educational_progress"
     SET "subject" = COALESCE($1, "subject"),
         "level" = COALESCE($2, "level"),
         "score" = CASE WHEN $3::boolean THEN $4::numeric ELSE "score" END,
         "notes" = CASE WHEN $5::boolean THEN $6 ELSE "notes" END,
         "assessedAt" = COALESCE($7::date, "assessedAt"),
         "assessedBy" = $8,
         "updatedAt" = now()
     WHERE "id" = $9 AND "childId" = $10
     RETURNING "id", "subject", "level", "score", "notes", "assessedAt"::text AS "assessedAt"`,
    [
      input.subject ?? null,
      input.level ?? null,
      input.score !== undefined,
      input.score ?? null,
      input.notes !== undefined,
      input.notes ?? null,
      input.assessedAt ?? null,
      access.userId,
      progressId,
      childId,
    ],
  );
  return { progress: row };
}

export async function deleteEducationalProgress(childId: string, progressId: string) {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM "educational_progress" WHERE "id" = $1 AND "childId" = $2 RETURNING "id"`,
    [progressId, childId],
  );
  return row ? { ok: true as const } : { error: 'not_found' as const };
}
