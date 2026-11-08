import { query, queryOne } from './db';
import type { AccessContext } from './middleware';
import { canWriteClass } from './middleware';
import { recordAudit } from './audit';
import { createNotification, notifyFollowUpStakeholders } from './notifications';
import { evaluateStudentRules, type RuleConfig } from './care-rules';
import {
  isIsoDate,
  isUuid,
  optionalText,
  todayIso,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
  oneOf,
} from './validation';

export interface FollowUpFilters {
  status?: string | null;
  classId?: string | null;
  servantId?: string | null;
  priority?: string | null;
  overdue?: boolean;
  activeOnly?: boolean;
  search?: string | null;
}

const ACTIVE_STATUSES = ['open', 'in_progress'];

function mapCase(row: any, today = todayIso()) {
  return {
    id: row.id,
    childId: row.childId,
    classId: row.classId,
    servantId: row.servantId,
    ruleId: row.ruleId,
    visitationId: row.visitationId,
    status: row.status,
    priority: row.priority,
    source: row.source,
    reason: row.reason,
    dueDate: row.dueDate,
    resolvedAt: row.resolvedAt,
    resolutionNotes: row.resolutionNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOverdue:
      ACTIVE_STATUSES.includes(row.status) && !!row.dueDate && row.dueDate < today,
    child: { id: row.childId, name: row.childName },
    class: row.classId ? { id: row.classId, name: row.className } : null,
    servant: row.servantId ? { id: row.servantId, name: row.servantName } : null,
    activityCount: Number(row.activityCount || 0),
    lastActivityAt: row.lastActivityAt,
  };
}

export async function listFollowUps(
  access: AccessContext,
  filters: FollowUpFilters,
  page: number,
  limit: number,
) {
  if (!access.privileged && access.classIds.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        summary: emptySummary(),
      },
    };
  }

  const scopeIds = access.privileged ? null : access.classIds;
  const offset = (page - 1) * limit;
  const params = [
    filters.status ?? null,
    filters.classId ?? null,
    filters.servantId ?? null,
    filters.priority ?? null,
    filters.search ?? null,
    scopeIds,
    filters.overdue ? true : null,
    filters.activeOnly ? true : null,
  ];

  const rows = await query<any>(
    `SELECT f."id", f."childId", f."classId", f."servantId", f."ruleId", f."visitationId",
            f."status", f."priority", f."source", f."reason", f."dueDate"::text AS "dueDate",
            f."resolvedAt", f."resolutionNotes", f."createdAt", f."updatedAt",
            c."name" AS "childName", cls."name" AS "className", s."name" AS "servantName",
            COUNT(a."id")::int AS "activityCount", MAX(a."occurredAt") AS "lastActivityAt"
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId" AND c."deletedAt" IS NULL
     LEFT JOIN "classes" cls ON cls."id" = f."classId"
     LEFT JOIN "servants" s ON s."id" = f."servantId"
     LEFT JOIN "follow_up_activities" a ON a."followUpId" = f."id"
     WHERE ($1::text IS NULL OR f."status" = $1)
       AND ($2::uuid IS NULL OR f."classId" = $2)
       AND ($3::uuid IS NULL OR f."servantId" = $3)
       AND ($4::text IS NULL OR f."priority" = $4)
       AND ($5::text IS NULL OR c."name" ILIKE '%' || $5 || '%' OR f."reason" ILIKE '%' || $5 || '%')
       AND ($6::uuid[] IS NULL OR f."classId" = ANY($6::uuid[]))
       AND ($7::boolean IS NULL OR ($7::boolean = true AND f."status" IN ('open', 'in_progress') AND f."dueDate" < CURRENT_DATE))
       AND ($8::boolean IS NULL OR ($8::boolean = true AND f."status" IN ('open', 'in_progress')))
     GROUP BY f."id", c."name", cls."name", s."name"
     ORDER BY
       CASE f."status" WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
       f."dueDate" ASC NULLS LAST,
       f."createdAt" DESC
     LIMIT $9 OFFSET $10`,
    [...params, limit, offset],
  );

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId" AND c."deletedAt" IS NULL
     WHERE ($1::text IS NULL OR f."status" = $1)
       AND ($2::uuid IS NULL OR f."classId" = $2)
       AND ($3::uuid IS NULL OR f."servantId" = $3)
       AND ($4::text IS NULL OR f."priority" = $4)
       AND ($5::text IS NULL OR c."name" ILIKE '%' || $5 || '%' OR f."reason" ILIKE '%' || $5 || '%')
       AND ($6::uuid[] IS NULL OR f."classId" = ANY($6::uuid[]))
       AND ($7::boolean IS NULL OR ($7::boolean = true AND f."status" IN ('open', 'in_progress') AND f."dueDate" < CURRENT_DATE))
       AND ($8::boolean IS NULL OR ($8::boolean = true AND f."status" IN ('open', 'in_progress')))`,
    params,
  );

  const summaryRows = await query<{
    open: number;
    inProgress: number;
    overdue: number;
    resolved: number;
    total: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE f."status" = 'open')::int AS open,
       COUNT(*) FILTER (WHERE f."status" = 'in_progress')::int AS "inProgress",
       COUNT(*) FILTER (
         WHERE f."status" IN ('open', 'in_progress')
           AND f."dueDate" < CURRENT_DATE
       )::int AS overdue,
       COUNT(*) FILTER (WHERE f."status" = 'resolved')::int AS resolved,
       COUNT(*)::int AS total
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId" AND c."deletedAt" IS NULL
     WHERE ($1::uuid IS NULL OR f."classId" = $1)
       AND ($2::uuid[] IS NULL OR f."classId" = ANY($2::uuid[]))`,
    [filters.classId ?? null, scopeIds],
  );

  const total = countRow?.total || 0;
  return {
    data: rows.map((row) => mapCase(row)),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: summaryRows[0] ?? emptySummary(),
    },
  };
}

function emptySummary() {
  return { open: 0, inProgress: 0, overdue: 0, resolved: 0, total: 0 };
}

export async function getFollowUpDetail(id: string, access: AccessContext) {
  const row = await queryOne<any>(
    `SELECT f."id", f."childId", f."classId", f."servantId", f."ruleId", f."visitationId",
            f."status", f."priority", f."source", f."reason", f."dueDate"::text AS "dueDate",
            f."resolvedAt", f."resolutionNotes", f."createdAt", f."updatedAt",
            c."name" AS "childName", c."classId" AS "childClassId", cls."name" AS "className",
            s."name" AS "servantName",
            (SELECT COUNT(*)::int FROM "follow_up_activities" a WHERE a."followUpId" = f."id") AS "activityCount",
            (SELECT MAX(a."occurredAt") FROM "follow_up_activities" a WHERE a."followUpId" = f."id") AS "lastActivityAt"
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId"
     LEFT JOIN "classes" cls ON cls."id" = f."classId"
     LEFT JOIN "servants" s ON s."id" = f."servantId"
     WHERE f."id" = $1 LIMIT 1`,
    [id],
  );
  if (!row) return null;

  if (!access.privileged && !access.classIds.includes(row.childClassId)) return 'forbidden' as const;

  const activities = await query<{
    id: string;
    type: string;
    title: string;
    notes: string | null;
    occurredAt: Date;
    actorName: string | null;
    actorId: string | null;
  }>(
    `SELECT a."id", a."type", a."title", a."notes", a."occurredAt",
            u."name" AS "actorName", a."createdBy" AS "actorId"
     FROM "follow_up_activities" a
     LEFT JOIN "users" u ON u."id" = a."createdBy"
     WHERE a."followUpId" = $1
     ORDER BY a."occurredAt" DESC`,
    [id],
  );

  return {
    followUp: mapCase(row),
    child: {
      id: row.childId,
      name: row.childName,
      classId: row.childClassId,
      className: row.className,
    },
    activities,
  };
}

export async function createFollowUp(
  access: AccessContext,
  input: {
    childId: string;
    servantId?: string | null;
    priority?: string | null;
    reason: string;
    dueDate?: string | null;
    source?: string;
    ruleId?: string | null;
  },
) {
  const child = await queryOne<{
    id: string;
    name: string;
    classId: string | null;
    assignedServantId: string | null;
  }>(
    `SELECT "id", "name", "classId", "assignedServantId"
     FROM "children" WHERE "id" = $1 AND "deletedAt" IS NULL LIMIT 1`,
    [input.childId],
  );
  if (!child) return { error: 'child_not_found' as const };
  if (!canWriteClass(access, child.classId)) return { error: 'forbidden' as const };

  let servantId = input.servantId ?? child.assignedServantId ?? null;
  if (servantId) {
    const servant = await queryOne<{ id: string }>(
      `SELECT s."id" FROM "servants" s
       WHERE s."id" = $1
         AND ($2::uuid IS NULL OR EXISTS (
           SELECT 1 FROM "servants_classes" sc
           WHERE sc."servantsId" = s."id" AND sc."classesId" = $2
         ))
       LIMIT 1`,
      [servantId, child.classId],
    );
    if (!servant) return { error: 'invalid_servant' as const };
  }

  const priority = oneOf(input.priority, FOLLOW_UP_PRIORITIES) ?? 'medium';
  const created = await queryOne<any>(
    `INSERT INTO "follow_ups"
       ("id", "childId", "classId", "servantId", "ruleId", "status", "priority", "source",
        "reason", "dueDate", "createdBy", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, 'open', $5, $6, $7, $8::date, $9, now(), now())
     RETURNING *`,
    [
      input.childId,
      child.classId,
      servantId,
      input.ruleId ?? null,
      priority,
      input.source === 'rule' ? 'rule' : input.source === 'visitation' ? 'visitation' : 'manual',
      input.reason,
      input.dueDate && isIsoDate(input.dueDate) ? input.dueDate : null,
      access.userId,
    ],
  );
  if (!created) return { error: 'insert_failed' as const };

  await query(
    `INSERT INTO "follow_up_activities" ("id", "followUpId", "childId", "type", "title", "notes", "createdBy", "occurredAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, 'status_change', 'تم فتح المتابعة', $3, $4, now(), now())`,
    [created.id, input.childId, input.reason, access.userId],
  );

  const notificationCount = await notifyFollowUpStakeholders({
    type: 'follow_up_assigned',
    title: `متابعة جديدة: ${child.name}`,
    body: servantId ? input.reason : `${input.reason} — لم يُعيَّن خادم مسؤول بعد.`,
    followUpId: created.id,
    servantId,
    classId: child.classId,
    dedupeKey: `followup-assigned:${created.id}`,
  });

  await recordAudit({
    actorId: access.userId,
    action: 'follow_up.create',
    entityType: 'follow_up',
    entityId: created.id,
    after: { childId: input.childId, priority, servantId, source: input.source ?? 'manual' },
  });

  return { followUp: mapCase({ ...created, childName: child.name, activityCount: 1 }), notificationCount };
}

export async function updateFollowUp(
  access: AccessContext,
  id: string,
  input: {
    status?: string | null;
    priority?: string | null;
    servantId?: string | null;
    dueDate?: string | null;
    resolutionNotes?: string | null;
  },
) {
  const existing = await queryOne<any>(
    `SELECT f.*, c."name" AS "childName", c."classId" AS "childClassId"
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId"
     WHERE f."id" = $1 LIMIT 1`,
    [id],
  );
  if (!existing) return { error: 'not_found' as const };
  if (!canWriteClass(access, existing.childClassId)) return { error: 'forbidden' as const };

  const status = input.status === undefined ? null : oneOf(input.status, FOLLOW_UP_STATUSES);
  if (input.status !== undefined && !status) return { error: 'invalid_status' as const };
  const priority = input.priority === undefined ? null : oneOf(input.priority, FOLLOW_UP_PRIORITIES);
  if (input.priority !== undefined && !priority) return { error: 'invalid_priority' as const };
  if (input.dueDate !== undefined && input.dueDate !== null && !isIsoDate(input.dueDate)) {
    return { error: 'invalid_due_date' as const };
  }
  if (input.servantId !== undefined && input.servantId !== null && !isUuid(input.servantId)) {
    return { error: 'invalid_servant' as const };
  }
  if (input.servantId) {
    const servant = await queryOne<{ id: string }>(
      `SELECT s."id" FROM "servants" s
       WHERE s."id" = $1
         AND EXISTS (SELECT 1 FROM "servants_classes" sc WHERE sc."servantsId" = s."id" AND sc."classesId" = $2)
       LIMIT 1`,
      [input.servantId, existing.childClassId],
    );
    if (!servant) return { error: 'invalid_servant' as const };
  }
  if (status === 'resolved' && !optionalText(input.resolutionNotes, 2000) && !existing.resolutionNotes) {
    return { error: 'resolution_required' as const };
  }

  const resolved = status === 'resolved' || status === 'dismissed';
  const updated = await queryOne<any>(
    `UPDATE "follow_ups"
     SET "status" = COALESCE($1, "status"),
         "priority" = COALESCE($2, "priority"),
         "servantId" = CASE WHEN $3::boolean THEN $4::uuid ELSE "servantId" END,
         "dueDate" = CASE WHEN $5::boolean THEN $6::date ELSE "dueDate" END,
         "resolutionNotes" = CASE WHEN $7::boolean THEN $8 ELSE "resolutionNotes" END,
         "resolvedAt" = CASE WHEN $1 = 'resolved' OR $1 = 'dismissed' THEN now()
                             WHEN $1 IN ('open', 'in_progress') THEN NULL
                             ELSE "resolvedAt" END,
         "updatedAt" = now()
     WHERE "id" = $9
     RETURNING *`,
    [
      status,
      priority,
      input.servantId !== undefined,
      input.servantId ?? null,
      input.dueDate !== undefined,
      input.dueDate ?? null,
      input.resolutionNotes !== undefined,
      optionalText(input.resolutionNotes, 2000),
      id,
    ],
  );
  if (!updated) return { error: 'update_failed' as const };

  const activityType = status === 'resolved' || status === 'dismissed' ? 'resolution' : 'status_change';
  const title =
    status === 'resolved'
      ? 'تم إغلاق المتابعة'
      : status === 'dismissed'
        ? 'تم استبعاد المتابعة'
        : input.servantId !== undefined
          ? 'تم تحديث الخادم المسؤول'
          : 'تم تحديث حالة المتابعة';
  await query(
    `INSERT INTO "follow_up_activities" ("id", "followUpId", "childId", "type", "title", "notes", "createdBy", "occurredAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())`,
    [id, existing.childId, activityType, title, optionalText(input.resolutionNotes, 2000), access.userId],
  );

  if (resolved) {
    await notifyFollowUpStakeholders({
      type: 'follow_up_completed',
      title: `اكتملت متابعة: ${existing.childName}`,
      body: optionalText(input.resolutionNotes, 2000) || 'تم إغلاق المتابعة.',
      followUpId: id,
      servantId: updated.servantId,
      classId: existing.childClassId,
      dedupeKey: `followup-resolved:${id}`,
    });
  }

  await recordAudit({
    actorId: access.userId,
    action: resolved ? 'follow_up.resolve' : 'follow_up.update',
    entityType: 'follow_up',
    entityId: id,
    before: { status: existing.status, priority: existing.priority, servantId: existing.servantId },
    after: updated,
  });

  return { followUp: mapCase({ ...updated, childName: existing.childName }) };
}

export async function addFollowUpActivity(
  access: AccessContext,
  id: string,
  input: { type: string; title: string; notes?: string | null },
) {
  const existing = await queryOne<any>(
    `SELECT f.*, c."classId" AS "childClassId" FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId" WHERE f."id" = $1 LIMIT 1`,
    [id],
  );
  if (!existing) return { error: 'not_found' as const };
  if (!canWriteClass(access, existing.childClassId)) return { error: 'forbidden' as const };

  const type = oneOf(input.type, ['note', 'call', 'message', 'visit'] as const);
  if (!type) return { error: 'invalid_type' as const };
  const title = optionalText(input.title, 180);
  if (!title) return { error: 'title_required' as const };

  const activity = await queryOne<any>(
    `INSERT INTO "follow_up_activities"
       ("id", "followUpId", "childId", "type", "title", "notes", "createdBy", "occurredAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())
     RETURNING *`,
    [id, existing.childId, type, title, optionalText(input.notes, 2000), access.userId],
  );

  if (existing.status === 'open') {
    await query(`UPDATE "follow_ups" SET "status" = 'in_progress', "updatedAt" = now() WHERE "id" = $1`, [id]);
  }

  await recordAudit({
    actorId: access.userId,
    action: 'follow_up.activity',
    entityType: 'follow_up',
    entityId: id,
    after: { type, title },
  });

  return { activity };
}

export async function listFollowUpRules() {
  return query<any>(
    `SELECT "id", "code", "name", "description", "ruleType", "threshold", "windowDays",
            "priority", "isActive", "createdAt", "updatedAt"
     FROM "follow_up_rules" ORDER BY "createdAt" ASC`,
  );
}

export async function updateFollowUpRule(
  access: AccessContext,
  id: string,
  input: { threshold?: number; windowDays?: number; isActive?: boolean; priority?: string },
) {
  if (!access.privileged) return { error: 'forbidden' as const };
  const existing = await queryOne<any>(`SELECT * FROM "follow_up_rules" WHERE "id" = $1 LIMIT 1`, [id]);
  if (!existing) return { error: 'not_found' as const };

  const threshold = input.threshold === undefined ? null : Number(input.threshold);
  const windowDays = input.windowDays === undefined ? null : Number(input.windowDays);
  if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0 || threshold > 1000)) {
    return { error: 'invalid_threshold' as const };
  }
  if (windowDays !== null && (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365)) {
    return { error: 'invalid_window' as const };
  }
  const priority = input.priority === undefined ? null : oneOf(input.priority, FOLLOW_UP_PRIORITIES);
  if (input.priority !== undefined && !priority) return { error: 'invalid_priority' as const };

  const updated = await queryOne<any>(
    `UPDATE "follow_up_rules"
     SET "threshold" = COALESCE($1, "threshold"),
         "windowDays" = COALESCE($2, "windowDays"),
         "isActive" = COALESCE($3, "isActive"),
         "priority" = COALESCE($4, "priority"),
         "updatedAt" = now()
     WHERE "id" = $5
     RETURNING *`,
    [threshold, windowDays, input.isActive ?? null, priority, id],
  );

  await recordAudit({
    actorId: access.userId,
    action: 'follow_up_rule.update',
    entityType: 'follow_up_rule',
    entityId: id,
    before: existing,
    after: updated,
  });

  return { rule: updated };
}

export async function evaluateFollowUps(
  access: AccessContext,
  filters: { classId?: string | null; childId?: string | null; dryRun?: boolean },
) {
  const rules = (await listFollowUpRules()).filter((rule) => rule.isActive) as RuleConfig[];
  if (rules.length === 0) {
    return { rules: 0, evaluatedStudents: 0, created: 0, flagged: 0, skipped: 0, alerts: [] };
  }

  const scopeIds = access.privileged ? null : access.classIds;
  if (!access.privileged && scopeIds && scopeIds.length === 0) {
    return { rules: rules.length, evaluatedStudents: 0, created: 0, flagged: 0, skipped: 0, alerts: [] };
  }

  const classId = isUuid(filters.classId) ? filters.classId : null;
  if (classId && !canWriteClass(access, classId)) return { error: 'forbidden' as const };
  const childId = isUuid(filters.childId) ? filters.childId : null;

  const students = await query<{
    id: string;
    name: string;
    classId: string | null;
    assignedServantId: string | null;
    createdAt: Date;
  }>(
    `SELECT "id", "name", "classId", "assignedServantId", "createdAt"
     FROM "children"
     WHERE "deletedAt" IS NULL
       AND ($1::uuid IS NULL OR "id" = $1)
       AND ($2::uuid IS NULL OR "classId" = $2)
       AND ($3::uuid[] IS NULL OR "classId" = ANY($3::uuid[]))`,
    [childId, classId, scopeIds],
  );

  if (students.length === 0) {
    return { rules: rules.length, evaluatedStudents: 0, created: 0, flagged: 0, skipped: 0, alerts: [] };
  }

  const studentIds = students.map((student) => student.id);
  const maxWindow = Math.max(90, ...rules.map((rule) => rule.windowDays));
  const asOf = todayIso();

  const attendance = await query<{ childId: string; date: string; status: string }>(
    `SELECT "childId", "date"::text AS "date", "status"::text AS "status"
     FROM "attendance"
     WHERE "childId" = ANY($1::uuid[])
       AND "date" >= (CURRENT_DATE - ($2::int || ' days')::interval)
       AND "date" <= CURRENT_DATE`,
    [studentIds, maxWindow + 30],
  );

  const visitations = await query<{
    childId: string;
    date: string;
    status: string;
    followUpDate: string | null;
  }>(
    `SELECT "childId", "date"::text AS "date", "status"::text AS "status",
            "followUpDate"::text AS "followUpDate"
     FROM "visitations"
     WHERE "childId" = ANY($1::uuid[])`,
    [studentIds],
  );

  const openCases = await query<{
    id: string;
    childId: string;
    dueDate: string | null;
    createdAt: Date;
    lastActivityAt: Date | null;
  }>(
    `SELECT f."id", f."childId", f."dueDate"::text AS "dueDate", f."createdAt",
            MAX(a."occurredAt") AS "lastActivityAt"
     FROM "follow_ups" f
     LEFT JOIN "follow_up_activities" a ON a."followUpId" = f."id"
     WHERE f."childId" = ANY($1::uuid[]) AND f."status" IN ('open', 'in_progress')
     GROUP BY f."id"`,
    [studentIds],
  );

  const classLeads = await query<{ classId: string; servantId: string; role: string }>(
    `SELECT sc."classesId" AS "classId", sc."servantsId" AS "servantId", s."role"::text AS "role"
     FROM "servants_classes" sc
     JOIN "servants" s ON s."id" = sc."servantsId"`,
  );
  const leadByClass = new Map<string, string>();
  for (const row of classLeads) {
    if (!leadByClass.has(row.classId) || row.role === 'قائد فصل') {
      leadByClass.set(row.classId, row.servantId);
    }
  }

  const attendanceByChild = new Map<string, { date: string; status: any }[]>();
  for (const row of attendance) {
    const list = attendanceByChild.get(row.childId) ?? [];
    list.push({ date: row.date, status: row.status });
    attendanceByChild.set(row.childId, list);
  }
  const visitsByChild = new Map<string, { date: string; status: any; followUpDate: string | null }[]>();
  for (const row of visitations) {
    const list = visitsByChild.get(row.childId) ?? [];
    list.push({ date: row.date, status: row.status, followUpDate: row.followUpDate });
    visitsByChild.set(row.childId, list);
  }
  const openByChild = new Map<string, (typeof openCases)[number]>();
  for (const row of openCases) {
    if (!openByChild.has(row.childId)) openByChild.set(row.childId, row);
  }

  const existingKeys = new Set(
    (
      await query<{ dedupeKey: string }>(
        `SELECT "dedupeKey" FROM "follow_ups"
         WHERE "childId" = ANY($1::uuid[]) AND "status" IN ('open', 'in_progress') AND "dedupeKey" IS NOT NULL`,
        [studentIds],
      )
    ).map((row) => row.dedupeKey),
  );

  const alerts: Array<{
    childId: string;
    childName: string;
    ruleCode: string;
    reason: string;
    action: string;
    created: boolean;
  }> = [];
  let created = 0;
  let flagged = 0;
  let skipped = 0;

  for (const student of students) {
    const open = openByChild.get(student.id);
    const applied = evaluateStudentRules(
      {
        childId: student.id,
        enrolledAt: new Date(student.createdAt).toISOString().slice(0, 10),
        attendance: (attendanceByChild.get(student.id) ?? []) as any,
        visitations: (visitsByChild.get(student.id) ?? []) as any,
        openFollowUp: open
          ? {
              id: open.id,
              dueDate: open.dueDate,
              lastActivityAt: open.lastActivityAt
                ? new Date(open.lastActivityAt).toISOString()
                : null,
              createdAt: new Date(open.createdAt).toISOString(),
            }
          : null,
      },
      rules,
      asOf,
    );

    for (const alert of applied) {
      alerts.push({
        childId: student.id,
        childName: student.name,
        ruleCode: alert.ruleCode,
        reason: alert.reason,
        action: alert.action,
        created: false,
      });

      if (alert.action === 'notify') {
        if (!filters.dryRun && alert.followUpId) {
          const notifications = await notifyFollowUpStakeholders({
            type: 'follow_up_overdue',
            title: `متابعة معلّقة: ${student.name}`,
            body: alert.reason,
            followUpId: alert.followUpId,
            servantId: open ? null : null,
            classId: student.classId,
            dedupeKey: `followup-overdue:${alert.followUpId}:${asOf}`,
          });
          if (notifications > 0) flagged += 1;
        }
        continue;
      }

      if (existingKeys.has(alert.dedupeKey)) {
        skipped += 1;
        continue;
      }

      if (filters.dryRun) continue;

      const servantId = student.assignedServantId || (student.classId ? leadByClass.get(student.classId) ?? null : null);
      const inserted = await queryOne<any>(
        `INSERT INTO "follow_ups"
           ("id", "childId", "classId", "servantId", "ruleId", "status", "priority", "source",
            "reason", "dedupeKey", "dueDate", "createdBy", "createdAt", "updatedAt")
         SELECT uuid_generate_v4(), $1, $2, $3, r."id", 'open', $4, 'rule', $5, $6, $7::date, $8, now(), now()
         FROM "follow_up_rules" r WHERE r."code" = $9
         ON CONFLICT ("dedupeKey") WHERE "dedupeKey" IS NOT NULL AND "status" IN ('open', 'in_progress')
         DO NOTHING
         RETURNING *`,
        [
          student.id,
          student.classId,
          servantId,
          alert.priority,
          alert.reason,
          alert.dedupeKey,
          alert.suggestedDueDate,
          access.userId,
          alert.ruleCode,
        ],
      );

      if (!inserted) {
        skipped += 1;
        continue;
      }

      await query(
        `INSERT INTO "follow_up_activities" ("id", "followUpId", "childId", "type", "title", "notes", "createdBy", "occurredAt", "createdAt")
         VALUES (uuid_generate_v4(), $1, $2, 'status_change', 'تم فتح المتابعة تلقائيًا', $3, $4, now(), now())`,
        [inserted.id, student.id, alert.reason, access.userId],
      );

      await notifyFollowUpStakeholders({
        type: 'follow_up_assigned',
        title: `متابعة جديدة: ${student.name}`,
        body: alert.reason,
        followUpId: inserted.id,
        servantId,
        classId: student.classId,
        dedupeKey: `followup-assigned:${inserted.id}`,
      });

      existingKeys.add(alert.dedupeKey);
      created += 1;
      const last = alerts[alerts.length - 1];
      last.created = true;
    }
  }

  await recordAudit({
    actorId: access.userId,
    action: 'follow_up.evaluate',
    entityType: 'follow_up_rule',
    entityId: null,
    after: { students: students.length, created, flagged, dryRun: !!filters.dryRun },
  });

  return {
    rules: rules.length,
    evaluatedStudents: students.length,
    created,
    flagged,
    skipped,
    alerts,
    dryRun: !!filters.dryRun,
  };
}
