import { query } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  jsonResponse,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isUuid, parseDateRange, ValidationError } from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const range = parseDateRange(searchParams, { defaultDays: 90, maxDays: 366 });

    if (classId && !canReadClass(access, classId)) return forbidden();
    if (!access.privileged && access.classIds.length === 0) {
      return jsonResponse({
        range,
        totals: { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: null, students: 0 },
        weekly: [],
        monthly: [],
        classes: [],
      });
    }

    const scopeIds = access.privileged ? null : access.classIds;
    const baseParams = [range.from, range.to, classId, scopeIds];

    const totals = await query<{
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      students: number;
    }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a."status"::text = 'present')::int AS present,
              COUNT(*) FILTER (WHERE a."status"::text = 'absent')::int AS absent,
              COUNT(*) FILTER (WHERE a."status"::text = 'late')::int AS late,
              COUNT(*) FILTER (WHERE a."status"::text = 'excused')::int AS excused,
              COUNT(DISTINCT a."childId")::int AS students
       FROM "attendance" a
       JOIN "children" c ON c."id" = a."childId" AND c."deletedAt" IS NULL
       WHERE a."date" BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR a."classId" = $3)
         AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))`,
      baseParams,
    );

    const weekly = await query<{
      bucket: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>(
      `WITH buckets AS (
         SELECT generate_series(
           date_trunc('week', $1::date),
           date_trunc('week', $2::date),
           interval '1 week'
         )::date AS bucket
       )
       SELECT b.bucket::text AS bucket,
              COUNT(a."id")::int AS total,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
       FROM buckets b
       LEFT JOIN "attendance" a
         ON a."date" >= b.bucket
        AND a."date" < b.bucket + 7
        AND ($3::uuid IS NULL OR a."classId" = $3)
        AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))
       LEFT JOIN "children" c ON c."id" = a."childId" AND c."deletedAt" IS NULL
       GROUP BY b.bucket
       ORDER BY b.bucket`,
      baseParams,
    );

    const monthly = await query<{
      bucket: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>(
      `WITH buckets AS (
         SELECT generate_series(
           date_trunc('month', $1::date),
           date_trunc('month', $2::date),
           interval '1 month'
         )::date AS bucket
       )
       SELECT b.bucket::text AS bucket,
              COUNT(a."id")::int AS total,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
       FROM buckets b
       LEFT JOIN "attendance" a
         ON a."date" >= b.bucket
        AND a."date" < b.bucket + interval '1 month'
        AND ($3::uuid IS NULL OR a."classId" = $3)
        AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))
       LEFT JOIN "children" c ON c."id" = a."childId" AND c."deletedAt" IS NULL
       GROUP BY b.bucket
       ORDER BY b.bucket`,
      baseParams,
    );

    const classes = await query<{
      id: string;
      name: string;
      grade: string;
      students: number;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>(
      `SELECT cls."id", cls."name", cls."grade"::text AS "grade",
              COUNT(DISTINCT c."id")::int AS students,
              COUNT(a."id")::int AS total,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
              COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
       FROM "classes" cls
       LEFT JOIN "children" c ON c."classId" = cls."id" AND c."deletedAt" IS NULL
       LEFT JOIN "attendance" a
         ON a."childId" = c."id"
        AND a."date" BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR a."classId" = $3)
       WHERE ($4::uuid[] IS NULL OR cls."id" = ANY($4::uuid[]))
         AND ($3::uuid IS NULL OR cls."id" = $3)
       GROUP BY cls."id"
       ORDER BY cls."name"`,
      baseParams,
    );

    const withRate = (row: { present: number; late: number; total: number }) => ({
      ...row,
      rate: row.total > 0 ? Math.round(((row.present + row.late) / row.total) * 1000) / 10 : null,
    });

    const totalRow = totals[0];
    return jsonResponse({
      range,
      totals: {
        ...totalRow,
        rate: totalRow && totalRow.total > 0
          ? Math.round(((totalRow.present + totalRow.late) / totalRow.total) * 1000) / 10
          : null,
      },
      weekly: weekly.map(withRate),
      monthly: monthly.map(withRate),
      classes: classes.map(withRate),
    });
  } catch (error: unknown) {
    if (error instanceof ValidationError) return jsonResponse({ message: error.message }, 400);
    console.error('Attendance report error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب تقرير الحضور');
  }
}
