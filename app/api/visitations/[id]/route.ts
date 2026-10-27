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
      servantId: string | null;
      date: string;
      type: string;
      status: string;
      notes: string | null;
      followUpDate: string | null;
      createdAt: Date;
      updatedAt: Date;
      childName: string | null;
      servantName: string | null;
    }>(
      `SELECT
         v.*,
         c."name" AS "childName",
         s."name" AS "servantName"
       FROM "visitations" v
       LEFT JOIN "children" c ON c."id" = v."childId"
       LEFT JOIN "servants" s ON s."id" = v."servantId"
       WHERE v."id" = $1
       LIMIT 1`,
      [id],
    );

    if (!row) {
      return notFound('سجل الافتقاد غير موجود');
    }

    return jsonResponse({
      ...row,
      child: { id: row.childId, name: row.childName },
      servant: row.servantId ? { id: row.servantId, name: row.servantName } : null,
    });
  } catch (error: any) {
    console.error('Get visitation error:', error);
    return serverError(error.message || 'فشل جلب تفاصيل الافتقاد');
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await queryOne(`SELECT "id" FROM "visitations" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!existing) {
      return notFound('سجل الافتقاد غير موجود');
    }

    const updated = await queryOne(
      `UPDATE "visitations"
       SET "servantId" = CASE WHEN $1::text IS NOT NULL THEN $1::uuid ELSE "servantId" END,
           "date" = COALESCE($2, "date"),
           "type" = COALESCE($3, "type"),
           "status" = COALESCE($4, "status"),
           "notes" = COALESCE($5, "notes"),
           "followUpDate" = CASE WHEN $6::text IS NOT NULL THEN $6::date ELSE "followUpDate" END,
           "updatedAt" = now()
       WHERE "id" = $7
       RETURNING *`,
      [
        body.servantId !== undefined ? body.servantId : null,
        body.date || null,
        body.type || null,
        body.status || null,
        body.notes || null,
        body.followUpDate !== undefined ? body.followUpDate : null,
        id,
      ],
    );

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Update visitation error:', error);
    return serverError(error.message || 'فشل تعديل سجل الافتقاد');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await query(`DELETE FROM "visitations" WHERE "id" = $1`, [id]);
    return jsonResponse({ message: 'تم حذف سجل الافتقاد بنجاح' });
  } catch (error: any) {
    console.error('Delete visitation error:', error);
    return serverError(error.message || 'فشل حذف سجل الافتقاد');
  }
}
