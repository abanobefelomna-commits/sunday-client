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
      name: string;
      birthDate: string;
      gender: string;
      parentPhone: string | null;
      parentName: string | null;
      address: string | null;
      notes: string | null;
      phone: string | null;
      avatar: string | null;
      classId: string | null;
      className: string | null;
      classGrade: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         c."id",
         c."name",
         c."birthDate",
         c."gender",
         c."parentPhone",
         c."parentName",
         c."address",
         c."notes",
         c."phone",
         c."avatar",
         c."classId",
         c."createdAt",
         c."updatedAt",
         cls."name" AS "className",
         cls."grade" AS "classGrade"
       FROM "children" c
       LEFT JOIN "classes" cls ON cls."id" = c."classId"
       WHERE c."id" = $1
       LIMIT 1`,
      [id],
    );

    if (!row) {
      return notFound('الطفل غير موجود');
    }

    return jsonResponse({
      id: row.id,
      name: row.name,
      birthDate: row.birthDate,
      gender: row.gender,
      parentPhone: row.parentPhone,
      parentName: row.parentName,
      address: row.address,
      notes: row.notes,
      phone: row.phone,
      avatar: row.avatar,
      classId: row.classId,
      class: row.classId
        ? {
            id: row.classId,
            name: row.className,
            grade: row.classGrade,
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (error: any) {
    console.error('Get child error:', error);
    return serverError(error.message || 'فشل جلب تفاصيل الطفل');
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await queryOne(`SELECT "id" FROM "children" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!existing) {
      return notFound('الطفل غير موجود');
    }

    const updated = await queryOne(
      `UPDATE "children"
       SET "name" = COALESCE($1, "name"),
           "birthDate" = COALESCE($2, "birthDate"),
           "gender" = COALESCE($3, "gender"),
           "parentPhone" = COALESCE($4, "parentPhone"),
           "parentName" = COALESCE($5, "parentName"),
           "address" = COALESCE($6, "address"),
           "notes" = COALESCE($7, "notes"),
           "classId" = CASE WHEN $8::text IS NOT NULL THEN $8::uuid ELSE "classId" END,
           "phone" = COALESCE($9, "phone"),
           "avatar" = COALESCE($10, "avatar"),
           "updatedAt" = now()
       WHERE "id" = $11
       RETURNING *`,
      [
        body.name || null,
        body.birthDate || null,
        body.gender || null,
        body.parentPhone || null,
        body.parentName || null,
        body.address || null,
        body.notes || null,
        body.classId !== undefined ? body.classId : null,
        body.phone || null,
        body.avatar || null,
        id,
      ],
    );

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Update child error:', error);
    return serverError(error.message || 'فشل تعديل بيانات الطفل');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await query(`DELETE FROM "children" WHERE "id" = $1`, [id]);
    return jsonResponse({ message: 'تم حذف الطفل بنجاح' });
  } catch (error: any) {
    console.error('Delete child error:', error);
    return serverError(error.message || 'فشل حذف الطفل');
  }
}
