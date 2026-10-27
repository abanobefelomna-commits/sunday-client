import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, serverError } from '@/src/server/middleware';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const row = await queryOne<{
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
       WHERE a."id" = $1
       LIMIT 1`,
      [id],
    );

    if (!row) {
      return notFound('سجل الحضور غير موجود');
    }

    return jsonResponse({
      id: row.id,
      childId: row.childId,
      classId: row.classId,
      date: row.date,
      status: row.status,
      notes: row.notes,
      recordedBy: row.recordedBy,
      createdAt: row.createdAt,
      child: {
        id: row.childId,
        name: row.childName,
      },
      class: {
        id: row.classId,
        name: row.className,
      },
    });
  } catch (error: any) {
    console.error('Get attendance record error:', error);
    return serverError(error.message || 'فشل جلب سجل الحضور');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await query(`DELETE FROM "attendance" WHERE "id" = $1`, [id]);
    return jsonResponse({ message: 'تم حذف سجل الحضور' });
  } catch (error: any) {
    console.error('Delete attendance record error:', error);
    return serverError(error.message || 'فشل حذف سجل الحضور');
  }
}
