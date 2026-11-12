import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  canWriteClass,
  jsonResponse,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isIsoDate, isUuid, optionalText, todayIso } from '@/src/server/validation';

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '30', 10)));

    if (classId && !canReadClass(access, classId)) return forbidden();
    if (!access.privileged && access.classIds.length === 0) {
      return jsonResponse({ data: [], meta: { total: 0 } });
    }
    const scopeIds = access.privileged ? null : access.classIds;

    const rows = await query<{
      id: string;
      classId: string;
      date: string;
      notes: string | null;
      className: string | null;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      recordedBy: string | null;
      createdAt: Date;
    }>(
      `SELECT s."id", s."classId", s."date"::text AS "date", s."notes", s."createdBy" AS "recordedBy",
              s."createdAt", cls."name" AS "className",
              COUNT(a."id")::int AS total,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
       FROM "attendance_sessions" s
       LEFT JOIN "classes" cls ON cls."id" = s."classId"
       LEFT JOIN "attendance" a ON a."sessionId" = s."id"
       WHERE ($1::uuid IS NULL OR s."classId" = $1)
         AND ($2::date IS NULL OR s."date" >= $2)
         AND ($3::date IS NULL OR s."date" <= $3)
         AND ($4::uuid[] IS NULL OR s."classId" = ANY($4::uuid[]))
       GROUP BY s."id", cls."name"
       ORDER BY s."date" DESC, s."createdAt" DESC
       LIMIT $5`,
      [classId, dateFrom, dateTo, scopeIds, limit],
    );

    return jsonResponse({
      data: rows.map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round(((row.present + row.late) / row.total) * 1000) / 10 : null,
      })),
      meta: { total: rows.length },
    });
  } catch (error: unknown) {
    console.error('Get attendance sessions error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب جلسات الحضور');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const body = await req.json();
    const classId = body?.classId;
    const date = body?.date;

    if (!isUuid(classId)) return badRequest('معرّف الفصل غير صالح');
    if (!isIsoDate(date)) return badRequest('التاريخ غير صالح');
    if (date > todayIso()) return badRequest('لا يمكن إنشاء جلسة بتاريخ مستقبلي');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, classId)) return forbidden();

    const session = await queryOne<{ id: string; classId: string; date: string; notes: string | null }>(
      `INSERT INTO "attendance_sessions" ("classId", "date", "notes", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT ("classId", "date") DO UPDATE
         SET "notes" = COALESCE(EXCLUDED."notes", "attendance_sessions"."notes"),
             "updatedAt" = now()
       RETURNING "id", "classId", "date"::text AS "date", "notes"`,
      [classId, date, optionalText(body?.notes, 500), auth.sub],
    );

    return jsonResponse(session, 201);
  } catch (error: unknown) {
    console.error('Create attendance session error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إنشاء جلسة الحضور');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
