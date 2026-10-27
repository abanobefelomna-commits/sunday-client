import { query } from '@/src/server/db';
import { jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');

    if (!classId || !date) {
      return badRequest('معرف الفصل والتاريخ مطلوبان');
    }

    const records = await query<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
      notes: string | null;
      childName: string | null;
    }>(
      `SELECT
         a."id",
         a."childId",
         a."classId",
         a."date",
         a."status",
         a."notes",
         c."name" AS "childName"
       FROM "attendance" a
       JOIN "children" c ON c."id" = a."childId"
       WHERE a."classId" = $1 AND a."date" = $2
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
        child: {
          id: r.childId,
          name: r.childName,
        },
      })),
    };

    return jsonResponse(summary);
  } catch (error: any) {
    console.error('Attendance summary error:', error);
    return serverError(error.message || 'فشل جلب ملخص الحضور');
  }
}
