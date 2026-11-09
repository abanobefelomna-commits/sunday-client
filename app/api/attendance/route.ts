export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { query, queryOne } from '@/src/server/db';
import { getAuthUser, getAccessContext, canReadClass, jsonResponse, forbidden, unauthorized, serverError } from '@/src/server/middleware';
import { isUuid, oneOf, ATTENDANCE_STATUSES } from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!access.privileged && access.classIds.length === 0) {
      return jsonResponse({ data: [], total: 0, meta: { total: 0, page: 1, limit: 50, totalPages: 0 } });
    }

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const childId = isUuid(searchParams.get('childId')) ? searchParams.get('childId') : null;
    const date = searchParams.get('date') || null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const status = oneOf(searchParams.get('status'), ATTENDANCE_STATUSES);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    if (classId && !canReadClass(access, classId)) return forbidden();
    const scopeIds = access.privileged ? null : access.classIds;

    const rows = await query<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
      notes: string | null;
      recordedBy: string | null;
      updatedBy: string | null;
      sessionId: string | null;
      childName: string | null;
      className: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         a."id", a."childId", a."classId", a."date"::text AS "date",
         a."status"::text AS "status", a."notes", a."recordedBy", a."updatedBy",
         a."sessionId", a."createdAt", a."updatedAt",
         c."name" AS "childName", cls."name" AS "className"
       FROM "attendance" a
       JOIN "children" c ON c."id" = a."childId"
       LEFT JOIN "classes" cls ON cls."id" = a."classId"
       WHERE c."deletedAt" IS NULL
         AND ($1::uuid IS NULL OR a."classId" = $1)
         AND ($2::uuid IS NULL OR a."childId" = $2)
         AND ($3::date IS NULL OR a."date" = $3)
         AND ($4::date IS NULL OR a."date" >= $4)
         AND ($5::date IS NULL OR a."date" <= $5)
         AND ($6::text IS NULL OR a."status"::text = $6)
         AND ($7::uuid[] IS NULL OR a."classId" = ANY($7::uuid[]))
       ORDER BY a."date" DESC, c."name" ASC
       LIMIT $8 OFFSET $9`,
      [classId, childId, date, dateFrom, dateTo, status, scopeIds, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "attendance" a
       JOIN "children" c ON c."id" = a."childId"
       WHERE c."deletedAt" IS NULL
         AND ($1::uuid IS NULL OR a."classId" = $1)
         AND ($2::uuid IS NULL OR a."childId" = $2)
         AND ($3::date IS NULL OR a."date" = $3)
         AND ($4::date IS NULL OR a."date" >= $4)
         AND ($5::date IS NULL OR a."date" <= $5)
         AND ($6::text IS NULL OR a."status"::text = $6)
         AND ($7::uuid[] IS NULL OR a."classId" = ANY($7::uuid[]))`,
      [classId, childId, date, dateFrom, dateTo, status, scopeIds],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      classId: r.classId,
      sessionId: r.sessionId,
      date: r.date,
      status: r.status,
      notes: r.notes,
      recordedBy: r.recordedBy,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      child: { id: r.childId, name: r.childName },
      class: { id: r.classId, name: r.className },
    }));

    return jsonResponse({
      data,
      total,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    console.error('Get attendance error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب سجلات الحضور');
  }
}
