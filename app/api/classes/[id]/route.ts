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

    const isGeneral = cls.grade === 'general';
    const children = await query<{
      id: string;
      name: string;
      birthDate: string;
      gender: string;
      parentPhone: string | null;
      phone: string | null;
      avatar: string | null;
    }>(
      isGeneral
        ? `SELECT "id", "name", "birthDate", "gender", "parentPhone", "phone", "avatar"
           FROM "children"
           ORDER BY "name" ASC`
        : `SELECT "id", "name", "birthDate", "gender", "parentPhone", "phone", "avatar"
           FROM "children"
           WHERE "classId" = $1
           ORDER BY "name" ASC`,
      isGeneral ? [] : [id],
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

export async function PATCH() {
  return jsonResponse(
    { message: 'الفصول ثابتة ولا يمكن تعديلها' },
    405,
  );
}

export async function DELETE() {
  return jsonResponse(
    { message: 'الفصول ثابتة ولا يمكن حذفها' },
    405,
  );
}
