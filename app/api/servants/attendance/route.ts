import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { requireTenantContext } from '@/src/server/tenant/context';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  forbidden,
  unauthorized,
  serverError,
  badRequest,
  conflict,
  notFound,
} from '@/src/server/middleware';
import {
  isUuid,
  isIsoDate,
  oneOf,
  parsePagination,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from '@/src/server/validation';

async function canManageServantAttendance(
  access: Awaited<ReturnType<typeof getAccessContext>>,
  classId: string,
): Promise<boolean> {
  if (access.privileged) return true;
  if (!access.servantId) return false;

  const row = await queryOne<{ id: string }>(
    `SELECT c."id"
     FROM "classes" c
     WHERE c."id" = $1
       AND (
         c."leadServantId" = $2
         OR EXISTS (
           SELECT 1
           FROM "servants" s
           JOIN "servants_classes" sc ON sc."servantsId" = s."id"
           WHERE s."id" = $2
             AND sc."classesId" = c."id"
             AND s."role" = 'قائد فصل'
         )
       )
     LIMIT 1`,
    [classId, access.servantId],
  );
  return !!row;
}

async function servantBelongsToClass(servantId: string, classId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT 1 AS "id"
     FROM "servants_classes"
     WHERE "servantsId" = $1 AND "classesId" = $2
     LIMIT 1`,
    [servantId, classId],
  );
  return !!row;
}

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const access = await getAccessContext(auth);
    const tenantId = requireTenantContext().churchId;
    const { searchParams } = new URL(req.url);

    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const servantId = isUuid(searchParams.get('servantId')) ? searchParams.get('servantId') : null;
    const date = isIsoDate(searchParams.get('date')) ? searchParams.get('date') : null;
    const dateFrom = isIsoDate(searchParams.get('dateFrom')) ? searchParams.get('dateFrom') : null;
    const dateTo = isIsoDate(searchParams.get('dateTo')) ? searchParams.get('dateTo') : null;
    const status = oneOf(searchParams.get('status'), ATTENDANCE_STATUSES);
    const { page, limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 200 });

    const emptyResponse = () =>
      jsonResponse({
        data: [],
        total: 0,
        summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
        byServant: [],
        meta: { total: 0, page: 1, limit, totalPages: 0 },
      });

    if (classId && !(await canManageServantAttendance(access, classId))) {
      return forbidden('عرض حضور الخدام متاح لقائد الفصل والمسؤول والكاهن فقط');
    }

    // Non-privileged users only see attendance for classes they lead.
    let scopeIds: string[] | null = null;
    if (!access.privileged) {
      const ledClasses = access.servantId
        ? await query<{ id: string }>(
            `SELECT c."id"
             FROM "classes" c
             WHERE c."churchId" = $1 AND c."deletedAt" IS NULL
               AND (
                 c."leadServantId" = $2
                 OR EXISTS (
                   SELECT 1
                   FROM "servants" s
                   JOIN "servants_classes" sc ON sc."servantsId" = s."id"
                   WHERE s."id" = $2
                     AND sc."classesId" = c."id"
                     AND s."role" = 'قائد فصل'
                 )
               )`,
            [tenantId, access.servantId],
          )
        : [];
      scopeIds = ledClasses.map((row) => row.id);
      if (scopeIds.length === 0) return emptyResponse();
    }

    const filters = [tenantId, classId, servantId, date, dateFrom, dateTo, status, scopeIds];

    const rows = await query<{
      id: string;
      servantId: string;
      classId: string;
      date: string;
      status: AttendanceStatus;
      notes: string | null;
      recordedBy: string | null;
      servantName: string | null;
      className: string | null;
      recordedByName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         a."id", a."servantId", a."classId", a."date"::text AS "date",
         a."status"::text AS "status", a."notes", a."recordedBy",
         a."createdAt", a."updatedAt",
         s."name" AS "servantName",
         c."name" AS "className",
         u."name" AS "recordedByName"
       FROM "servant_attendance" a
       JOIN "servants" s ON s."id" = a."servantId"
       JOIN "classes" c ON c."id" = a."classId"
       LEFT JOIN "users" u ON u."id" = a."recordedBy"
       WHERE c."churchId" = $1
         AND ($2::uuid IS NULL OR a."classId" = $2)
         AND ($3::uuid IS NULL OR a."servantId" = $3)
         AND ($4::date IS NULL OR a."date" = $4)
         AND ($5::date IS NULL OR a."date" >= $5)
         AND ($6::date IS NULL OR a."date" <= $6)
         AND ($7::text IS NULL OR a."status"::text = $7)
         AND ($8::uuid[] IS NULL OR a."classId" = ANY($8::uuid[]))
       ORDER BY a."date" DESC, s."name" ASC
       LIMIT $9 OFFSET $10`,
      [...filters, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "servant_attendance" a
       JOIN "classes" c ON c."id" = a."classId"
       WHERE c."churchId" = $1
         AND ($2::uuid IS NULL OR a."classId" = $2)
         AND ($3::uuid IS NULL OR a."servantId" = $3)
         AND ($4::date IS NULL OR a."date" = $4)
         AND ($5::date IS NULL OR a."date" >= $5)
         AND ($6::date IS NULL OR a."date" <= $6)
         AND ($7::text IS NULL OR a."status"::text = $7)
         AND ($8::uuid[] IS NULL OR a."classId" = ANY($8::uuid[]))`,
      filters,
    );

    const summaryRow = await queryOne<{
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE a."status" = 'present')::int AS present,
         COUNT(*) FILTER (WHERE a."status" = 'absent')::int AS absent,
         COUNT(*) FILTER (WHERE a."status" = 'late')::int AS late,
         COUNT(*) FILTER (WHERE a."status" = 'excused')::int AS excused
       FROM "servant_attendance" a
       JOIN "classes" c ON c."id" = a."classId"
       WHERE c."churchId" = $1
         AND ($2::uuid IS NULL OR a."classId" = $2)
         AND ($3::uuid IS NULL OR a."servantId" = $3)
         AND ($4::date IS NULL OR a."date" = $4)
         AND ($5::date IS NULL OR a."date" >= $5)
         AND ($6::date IS NULL OR a."date" <= $6)
         AND ($7::text IS NULL OR a."status"::text = $7)
         AND ($8::uuid[] IS NULL OR a."classId" = ANY($8::uuid[]))`,
      filters,
    );

    const byServant = await query<{
      servantId: string;
      servantName: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>(
      `SELECT
         a."servantId",
         s."name" AS "servantName",
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE a."status" = 'present')::int AS present,
         COUNT(*) FILTER (WHERE a."status" = 'absent')::int AS absent,
         COUNT(*) FILTER (WHERE a."status" = 'late')::int AS late,
         COUNT(*) FILTER (WHERE a."status" = 'excused')::int AS excused
       FROM "servant_attendance" a
       JOIN "servants" s ON s."id" = a."servantId"
       JOIN "classes" c ON c."id" = a."classId"
       WHERE c."churchId" = $1
         AND ($2::uuid IS NULL OR a."classId" = $2)
         AND ($3::uuid IS NULL OR a."servantId" = $3)
         AND ($4::date IS NULL OR a."date" = $4)
         AND ($5::date IS NULL OR a."date" >= $5)
         AND ($6::date IS NULL OR a."date" <= $6)
         AND ($7::text IS NULL OR a."status"::text = $7)
         AND ($8::uuid[] IS NULL OR a."classId" = ANY($8::uuid[]))
       GROUP BY a."servantId", s."name"
       ORDER BY s."name" ASC`,
      filters,
    );

    const total = countRow?.total ?? 0;

    return jsonResponse({
      data: rows.map((row) => ({
        id: row.id,
        servantId: row.servantId,
        classId: row.classId,
        date: row.date,
        status: row.status,
        notes: row.notes,
        recordedBy: row.recordedBy,
        recordedByName: row.recordedByName,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        servant: { id: row.servantId, name: row.servantName },
        class: { id: row.classId, name: row.className },
      })),
      total,
      summary: {
        total: summaryRow?.total ?? 0,
        present: summaryRow?.present ?? 0,
        absent: summaryRow?.absent ?? 0,
        late: summaryRow?.late ?? 0,
        excused: summaryRow?.excused ?? 0,
      },
      byServant,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    console.error('Get servant attendance error:', error);
    return serverError('فشل جلب سجلات حضور الخدام');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const tenantId = requireTenantContext().churchId;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات الحضور غير صالحة');
    }

    const servantId = body.servantId;
    const classId = body.classId;
    const date = body.date;
    const status = oneOf(body.status ?? 'present', ATTENDANCE_STATUSES);
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;

    if (!isUuid(servantId)) return badRequest('معرّف الخادم غير صالح');
    if (!isUuid(classId)) return badRequest('معرّف الفصل غير صالح');
    if (!isIsoDate(date)) return badRequest('التاريخ غير صالح');
    if (!status) return badRequest('حالة الحضور غير صالحة');
    if (notes && notes.length > 500) return badRequest('الملاحظات أطول من الحد المسموح');

    const classRow = await queryOne<{ id: string }>(
      `SELECT "id" FROM "classes" WHERE "id" = $1 AND "churchId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
      [classId, tenantId],
    );
    if (!classRow) return notFound('الفصل غير موجود');

    if (!(await canManageServantAttendance(access, classId))) {
      return forbidden('تسجيل حضور الخدام متاح لقائد الفصل والمسؤول والكاهن فقط');
    }

    if (!(await servantBelongsToClass(servantId, classId))) {
      return badRequest('الخادم غير معيّن لهذا الفصل');
    }

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO "servant_attendance"
         ("id", "servantId", "classId", "date", "status", "notes", "recordedBy", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())
       ON CONFLICT ("servantId", "date") DO NOTHING
       RETURNING "id"`,
      [servantId, classId, date, status, notes, auth.sub],
    );

    if (!inserted) {
      return conflict('تم تسجيل حضور هذا الخادم مسبقًا في هذا التاريخ');
    }

    return jsonResponse({ id: inserted.id, message: 'تم تسجيل الحضور بنجاح' }, 201);
  } catch (error: unknown) {
    console.error('Create servant attendance error:', error);
    return serverError('تعذر تسجيل حضور الخادم');
  }
}

async function PUTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const tenantId = requireTenantContext().churchId;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات الحضور غير صالحة');
    }

    const id = body.id;
    if (!isUuid(id)) return badRequest('معرّف السجل غير صالح');

    const existing = await queryOne<{ id: string; classId: string }>(
      `SELECT a."id", a."classId"
       FROM "servant_attendance" a
       JOIN "classes" c ON c."id" = a."classId"
       WHERE a."id" = $1 AND c."churchId" = $2
       LIMIT 1`,
      [id, tenantId],
    );
    if (!existing) return notFound('سجل الحضور غير موجود');

    if (!(await canManageServantAttendance(access, existing.classId))) {
      return forbidden('تعديل حضور الخدام متاح لقائد الفصل والمسؤول والكاهن فقط');
    }

    const status = body.status === undefined ? undefined : oneOf(body.status, ATTENDANCE_STATUSES);
    if (body.status !== undefined && !status) return badRequest('حالة الحضور غير صالحة');
    const notes =
      body.notes === undefined ? undefined : typeof body.notes === 'string' ? body.notes.trim() || null : null;

    const updated = await queryOne<{ id: string }>(
      `UPDATE "servant_attendance"
       SET "status" = COALESCE($2, "status"),
           "notes" = CASE WHEN $3::boolean THEN $4 ELSE "notes" END,
           "updatedAt" = now()
       WHERE "id" = $1
       RETURNING "id"`,
      [id, status ?? null, body.notes !== undefined, notes ?? null],
    );

    if (!updated) return notFound('سجل الحضور غير موجود');
    return jsonResponse({ id: updated.id, message: 'تم تحديث سجل الحضور بنجاح' });
  } catch (error: unknown) {
    console.error('Update servant attendance error:', error);
    return serverError('تعذر تحديث سجل الحضور');
  }
}

async function DELETEHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const tenantId = requireTenantContext().churchId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!isUuid(id)) return badRequest('معرّف السجل غير صالح');

    const existing = await queryOne<{ id: string; classId: string }>(
      `SELECT a."id", a."classId"
       FROM "servant_attendance" a
       JOIN "classes" c ON c."id" = a."classId"
       WHERE a."id" = $1 AND c."churchId" = $2
       LIMIT 1`,
      [id, tenantId],
    );
    if (!existing) return notFound('سجل الحضور غير موجود');

    if (!(await canManageServantAttendance(access, existing.classId))) {
      return forbidden('حذف حضور الخدام متاح لقائد الفصل والمسؤول والكاهن فقط');
    }

    await query(`DELETE FROM "servant_attendance" WHERE "id" = $1`, [id]);
    return jsonResponse({ message: 'تم حذف سجل الحضور بنجاح' });
  } catch (error: unknown) {
    console.error('Delete servant attendance error:', error);
    return serverError('تعذر حذف سجل الحضور');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
export const PUT = withTenant(PUTHandler);
export const DELETE = withTenant(DELETEHandler);
