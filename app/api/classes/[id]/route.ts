import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, serverError } from '@/src/server/middleware';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const cls = await queryOne<{
      id: string;
      name: string;
      grade: string;
      description: string | null;
      academicYear: string | null;
      image: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(`SELECT * FROM "classes" WHERE "id" = $1 LIMIT 1`, [id]);

    if (!cls) {
      return notFound('الفصل غير موجود');
    }

    const servants = await query<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      role: string;
      avatar: string | null;
    }>(
      `SELECT s."id", s."name", s."phone", s."email", s."role", s."avatar"
       FROM "servants" s
       JOIN "servants_classes" sc ON sc."servantsId" = s."id"
       WHERE sc."classesId" = $1
       ORDER BY s."name" ASC`,
      [id],
    );

    const children = await query<{
      id: string;
      name: string;
      birthDate: string;
      gender: string;
      parentPhone: string | null;
      phone: string | null;
      avatar: string | null;
    }>(
      `SELECT "id", "name", "birthDate", "gender", "parentPhone", "phone", "avatar"
       FROM "children"
       WHERE "classId" = $1
       ORDER BY "name" ASC`,
      [id],
    );

    return jsonResponse({
      ...cls,
      servants,
      children,
      childrenCount: children.length,
      servantsCount: servants.length,
    });
  } catch (error: any) {
    console.error('Get class details error:', error);
    return serverError(error.message || 'فشل جلب تفاصيل الفصل');
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, grade, description, academicYear } = body;

    const updated = await queryOne(
      `UPDATE "classes"
       SET "name" = COALESCE($1, "name"),
           "grade" = COALESCE($2, "grade"),
           "description" = COALESCE($3, "description"),
           "academicYear" = COALESCE($4, "academicYear"),
           "updatedAt" = now()
       WHERE "id" = $5
       RETURNING *`,
      [name || null, grade || null, description || null, academicYear || null, id],
    );

    if (!updated) {
      return notFound('الفصل غير موجود');
    }

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Update class error:', error);
    return serverError(error.message || 'فشل تعديل الفصل');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Remove join relations
    await query(`DELETE FROM "servants_classes" WHERE "classesId" = $1`, [id]);
    // Set children classId to null
    await query(`UPDATE "children" SET "classId" = NULL WHERE "classId" = $1`, [id]);
    // Delete class
    await query(`DELETE FROM "classes" WHERE "id" = $1`, [id]);

    return jsonResponse({ message: 'تم حذف الفصل بنجاح' });
  } catch (error: any) {
    console.error('Delete class error:', error);
    return serverError(error.message || 'فشل حذف الفصل');
  }
}
