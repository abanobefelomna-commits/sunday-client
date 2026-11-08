import { query } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  jsonResponse,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isIsoDate, isUuid } from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');

    if (!isUuid(classId) || !isIsoDate(date)) {
      return badRequest('معرف الفصل والتاريخ مطلوبان');
    }

    const access = await getAccessContext(auth);
    if (!canReadClass(access, classId)) return forbidden();

    const records = await query<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
      notes: string | null;
      childName: string | null;
    }>(
      `SELECT a."id", a."childId", a."classId", a."date"::text AS "date",
              a."status"::text AS "status", a."notes", c."name" AS "childName"
       FROM "attendance" a
       JOIN "children" c ON c."id" = a."childId"
       WHERE a."classId" = $1 AND a."date" = $2 AND c."deletedAt" IS NULL
       ORDER BY c."name" ASC`,
      [classId, date],
    );

    const summary = {
      date,
      classId,
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused').length,
      records: records.map((r) => ({
        id: r.id,
        childId: r.childId,
        classId: r.classId,
        date: r.date,
        status: r.status,
        notes: r.notes,
        child: { id: r.childId, name: r.childName },
      })),
    };

    return jsonResponse(summary);
  } catch (error: unknown) {
    console.error('Attendance summary error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب ملخص الحضور');
  }
}
