import { query, queryOne } from '@/src/server/db';
import { jsonResponse, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId') || null;
    const childId = searchParams.get('childId') || null;
    const date = searchParams.get('date') || null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const status = searchParams.get('status') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const rows = await query<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
      notes: string | null;
      recordedBy: string | null;
      childName: string | null;
      className: string | null;
      createdAt: Date;
    }>(
      `SELECT
         a."id",
         a."childId",
         a."classId",
         a."date",
         a."status",
         a."notes",
         a."recordedBy",
         a."createdAt",
         c."name" AS "childName",
         cls."name" AS "className"
       FROM "attendance" a
       LEFT JOIN "children" c ON c."id" = a."childId"
       LEFT JOIN "classes" cls ON cls."id" = a."classId"
       WHERE ($1::uuid IS NULL OR a."classId" = $1)
         AND ($2::uuid IS NULL OR a."childId" = $2)
         AND ($3::date IS NULL OR a."date" = $3)
         AND ($4::date IS NULL OR a."date" >= $4)
         AND ($5::date IS NULL OR a."date" <= $5)
         AND ($6::text IS NULL OR a."status"::text = $6)
       ORDER BY a."date" DESC, c."name" ASC
       LIMIT $7 OFFSET $8`,
      [classId, childId, date, dateFrom, dateTo, status, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "attendance" a
       WHERE ($1::uuid IS NULL OR a."classId" = $1)
         AND ($2::uuid IS NULL OR a."childId" = $2)
         AND ($3::date IS NULL OR a."date" = $3)
         AND ($4::date IS NULL OR a."date" >= $4)
         AND ($5::date IS NULL OR a."date" <= $5)
         AND ($6::text IS NULL OR a."status"::text = $6)`,
      [classId, childId, date, dateFrom, dateTo, status],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      classId: r.classId,
      date: r.date,
      status: r.status,
      notes: r.notes,
      recordedBy: r.recordedBy,
      createdAt: r.createdAt,
      child: {
        id: r.childId,
        name: r.childName,
      },
      class: {
        id: r.classId,
        name: r.className,
      },
    }));

    return jsonResponse({
      data,
      total,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get attendance error:', error);
    return serverError(error.message || 'فشل جلب سجلات الحضور');
  }
}
