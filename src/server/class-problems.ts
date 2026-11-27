import { query, queryOne } from './db';
import type { AccessContext } from './middleware';
import { canReadClass, canWriteClass, readScopeClassIds } from './middleware';
import { recordAudit } from './audit';
import { optionalText, requiredText, oneOf } from './validation';

export const PROBLEM_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const;
export const PROBLEM_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const PROBLEM_CATEGORIES = [
  'class_issue',
  'missing_resource',
  'student_issue',
  'attendance_issue',
  'technical_issue',
  'support_request',
  'general_request',
  'other',
] as const;

export interface ClassProblemFilters {
  status?: string | null;
  classId?: string | null;
  priority?: string | null;
  search?: string | null;
}

function mapReport(row: {
  id: string;
  classId: string | null;
  reporterId: string | null;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  className?: string | null;
  reporterName?: string | null;
}) {
  return {
    id: row.id,
    classId: row.classId,
    category: row.category,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    class: row.classId ? { id: row.classId, name: row.className ?? null } : null,
    reporter: row.reporterId ? { id: row.reporterId, name: row.reporterName ?? null } : null,
  };
}

const WHERE_FILTERS = `
       ($1::text IS NULL OR p."status" = $1)
   AND ($2::uuid IS NULL OR p."classId" = $2)
   AND ($3::text IS NULL OR p."priority" = $3)
   AND ($4::text IS NULL OR p."title" ILIKE '%' || $4 || '%' OR p."description" ILIKE '%' || $4 || '%')
   AND ($5::uuid[] IS NULL OR p."classId" = ANY($5::uuid[]))`;

export async function listClassProblems(
  access: AccessContext,
  filters: ClassProblemFilters,
  page: number,
  limit: number,
) {
  const scopeIds = readScopeClassIds(access);
  if (scopeIds !== null && scopeIds.length === 0) {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }

  const params = [
    filters.status ?? null,
    filters.classId ?? null,
    filters.priority ?? null,
    filters.search ?? null,
    scopeIds,
  ];
  const offset = (page - 1) * limit;

  const rows = await query<{
    id: string;
    classId: string;
    reporterId: string;
    category: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    className: string;
    reporterName: string;
  }>(
    `SELECT p."id", p."classId", p."reporterId", p."category", p."title", p."description",
            p."priority", p."status", p."resolutionNote", p."resolvedAt", p."createdAt", p."updatedAt",
            c."name" AS "className", u."name" AS "reporterName"
     FROM "class_problem_reports" p
     JOIN "classes" c ON c."id" = p."classId"
     JOIN "users" u ON u."id" = p."reporterId"
     WHERE ${WHERE_FILTERS}
     ORDER BY
       CASE p."status" WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
       CASE p."priority" WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       p."createdAt" DESC
     LIMIT $6 OFFSET $7`,
    [...params, limit, offset],
  );

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM "class_problem_reports" p
     WHERE ${WHERE_FILTERS}`,
    params,
  );

  const total = countRow?.total || 0;
  return {
    data: rows.map(mapReport),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getClassProblem(access: AccessContext, id: string) {
  const row = await queryOne<{
    id: string;
    classId: string;
    reporterId: string;
    category: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    className: string;
    reporterName: string;
  }>(
    `SELECT p."id", p."classId", p."reporterId", p."category", p."title", p."description",
            p."priority", p."status", p."resolutionNote", p."resolvedAt", p."createdAt", p."updatedAt",
            c."name" AS "className", u."name" AS "reporterName"
     FROM "class_problem_reports" p
     JOIN "classes" c ON c."id" = p."classId"
     JOIN "users" u ON u."id" = p."reporterId"
     WHERE p."id" = $1 LIMIT 1`,
    [id],
  );
  if (!row) return null;
  if (!canReadClass(access, row.classId)) return 'forbidden' as const;
  return { report: mapReport(row) };
}

export async function createClassProblem(
  access: AccessContext,
  input: {
    classId: string;
    category: string;
    title: string;
    description: string;
    priority?: string | null;
  },
) {
  if (!canWriteClass(access, input.classId)) return { error: 'forbidden' as const };

  const category = oneOf(input.category, PROBLEM_CATEGORIES);
  if (!category) return { error: 'invalid_category' as const };
  const title = requiredText(input.title, 'عنوان المشكلة', 180);
  if (!title) return { error: 'title_required' as const };
  const description = requiredText(input.description, 'وصف المشكلة', 4000);
  if (!description) return { error: 'description_required' as const };
  const priority = oneOf(input.priority ?? 'medium', PROBLEM_PRIORITIES) ?? 'medium';

  const cls = await queryOne<{ id: string; name: string }>(
    `SELECT "id", "name" FROM "classes"
     WHERE "id" = $1 AND "isActive" = true AND "deletedAt" IS NULL LIMIT 1`,
    [input.classId],
  );
  if (!cls) return { error: 'class_not_found' as const };

  const created = await queryOne<{
    id: string;
    classId: string;
    reporterId: string;
    category: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `INSERT INTO "class_problem_reports"
       ("id", "classId", "reporterId", "category", "title", "description", "priority", "status", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, 'new', now(), now())
     RETURNING *`,
    [input.classId, access.userId, category, title, description, priority],
  );
  if (!created) return { error: 'insert_failed' as const };

  await recordAudit({
    actorId: access.userId,
    action: 'class_problem.create',
    entityType: 'class_problem',
    entityId: created.id,
    after: { classId: input.classId, category, priority },
  });

  return { report: mapReport({ ...created, className: cls.name }) };
}

export async function updateClassProblem(
  access: AccessContext,
  id: string,
  input: {
    status?: string | null;
    priority?: string | null;
    resolutionNote?: string | null;
  },
) {
  const existing = await queryOne<{
    id: string;
    classId: string;
    status: string;
    priority: string;
    title: string;
  }>(`SELECT * FROM "class_problem_reports" WHERE "id" = $1 LIMIT 1`, [id]);
  if (!existing) return { error: 'not_found' as const };
  if (!canWriteClass(access, existing.classId)) return { error: 'forbidden' as const };

  const status = input.status === undefined ? null : oneOf(input.status, PROBLEM_STATUSES);
  if (input.status !== undefined && !status) return { error: 'invalid_status' as const };
  const priority = input.priority === undefined ? null : oneOf(input.priority, PROBLEM_PRIORITIES);
  if (input.priority !== undefined && !priority) return { error: 'invalid_priority' as const };
  const note =
    input.resolutionNote === undefined
      ? null
      : input.resolutionNote === null || input.resolutionNote === ''
        ? null
        : optionalText(input.resolutionNote, 2000);
  if (input.resolutionNote !== undefined && input.resolutionNote !== null && input.resolutionNote !== '' && !note) {
    return { error: 'invalid_note' as const };
  }

  const updated = await queryOne<{
    id: string;
    classId: string;
    reporterId: string;
    category: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `UPDATE "class_problem_reports"
     SET "status" = COALESCE($1, "status"),
         "priority" = COALESCE($2, "priority"),
         "resolutionNote" = CASE WHEN $3::boolean THEN $4 ELSE "resolutionNote" END,
         "resolvedAt" = CASE
           WHEN $1 IN ('resolved', 'closed') THEN now()
           WHEN $1 IN ('new', 'in_progress') THEN NULL
           ELSE "resolvedAt" END,
         "updatedAt" = now()
     WHERE "id" = $5
     RETURNING *`,
    [
      status,
      priority,
      input.resolutionNote !== undefined,
      input.resolutionNote === null || input.resolutionNote === '' ? null : note,
      id,
    ],
  );
  if (!updated) return { error: 'update_failed' as const };

  await recordAudit({
    actorId: access.userId,
    action: updated.status === 'resolved' || updated.status === 'closed' ? 'class_problem.resolve' : 'class_problem.update',
    entityType: 'class_problem',
    entityId: id,
    before: { status: existing.status, priority: existing.priority },
    after: { status: updated.status, priority: updated.priority },
  });

  return { report: mapReport(updated) };
}