import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, serverError } from '@/src/server/middleware';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const servant = await queryOne<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      role: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(`SELECT * FROM "servants" WHERE "id" = $1 LIMIT 1`, [id]);

    if (!servant) {
      return notFound('الخادم غير موجود');
    }

    const classes = await query<{
      id: string;
      name: string;
      grade: string;
    }>(
      `SELECT c."id", c."name", c."grade"
       FROM "classes" c
       JOIN "servants_classes" sc ON sc."classesId" = c."id"
       WHERE sc."servantsId" = $1`,
      [id],
    );

    return jsonResponse({
      ...servant,
      classes,
    });
  } catch (error: any) {
    console.error('Get servant error:', error);
    return serverError(error.message || 'فشل جلب تفاصيل الخادم');
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, email, role, classIds } = body;

    const updated = await queryOne(
      `UPDATE "servants"
       SET "name" = COALESCE($1, "name"),
           "phone" = COALESCE($2, "phone"),
           "email" = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE "email" END,
           "role" = COALESCE($4, "role"),
           "updatedAt" = now()
       WHERE "id" = $5
       RETURNING *`,
      [name || null, phone || null, email !== undefined ? email : null, role || null, id],
    );

    if (!updated) {
      return notFound('الخادم غير موجود');
    }

    if (Array.isArray(classIds)) {
      await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [id]);
      for (const cId of classIds) {
        await query(
          `INSERT INTO "servants_classes" ("servantsId", "classesId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, cId],
        );
      }
    }

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Update servant error:', error);
    return serverError(error.message || 'فشل تعديل بيانات الخادم');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [id]);
    await query(`DELETE FROM "servants" WHERE "id" = $1`, [id]);

    return jsonResponse({ message: 'تم حذف الخادم بنجاح' });
  } catch (error: any) {
    console.error('Delete servant error:', error);
    return serverError(error.message || 'فشل حذف الخادم');
  }
}
