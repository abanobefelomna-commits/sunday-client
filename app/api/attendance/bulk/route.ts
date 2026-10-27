import { query } from '@/src/server/db';
import { getAuthUser, jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    const body = await req.json();
    const { classId, date, records } = body;

    if (!classId || !date || !Array.isArray(records)) {
      return badRequest('الفصل والتاريخ وسجلات الحضور مطلوبة');
    }

    const recordedBy = auth?.sub || null;

    for (const r of records) {
      if (!r.childId || !r.status) continue;

      await query(
        `INSERT INTO "attendance" ("id", "childId", "classId", "date", "status", "notes", "recordedBy", "createdAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now())
         ON CONFLICT ("childId", "classId", "date")
         DO UPDATE SET "status" = EXCLUDED."status",
                       "notes" = EXCLUDED."notes",
                       "recordedBy" = COALESCE(EXCLUDED."recordedBy", "attendance"."recordedBy")`,
        [r.childId, classId, date, r.status, r.notes || null, recordedBy],
      );
    }

    return jsonResponse({
      count: records.length,
      message: `تم تسجيل حضور ${records.length} طفل بنجاح`,
      date,
      classId,
    });
  } catch (error: any) {
    console.error('Bulk attendance error:', error);
    return serverError(error.message || 'فشل تسجيل الحضور');
  }
}
