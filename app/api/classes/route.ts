import { query, queryOne } from '@/src/server/db';
import { DEFAULT_CLASSES, ensureDefaultClasses } from '@/src/server/classes';
import { jsonResponse, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    await ensureDefaultClasses();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const grade = searchParams.get('grade') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const data = await query<{
      id: string;
      name: string;
      grade: string;
      description: string | null;
      academicYear: string | null;
      image: string | null;
      childrenCount: number;
      servantsCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         c."id",
         c."name",
         c."grade",
         c."description",
         c."academicYear",
         c."image",
         c."createdAt",
         c."updatedAt",
         COUNT(DISTINCT ch."id")::int AS "childrenCount",
         COUNT(DISTINCT sc."servantsId")::int AS "servantsCount"
       FROM (
         SELECT DISTINCT ON (source."grade"::text) source.*
         FROM "classes" source
         WHERE source."grade"::text = ANY($5::text[])
         ORDER BY source."grade"::text, source."createdAt" ASC, source."id" ASC
       ) c
       LEFT JOIN "children" ch ON ch."classId" = c."id"
       LEFT JOIN "servants_classes" sc ON sc."classesId" = c."id"
       WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."grade"::text = $2)
       GROUP BY
         c."id",
         c."name",
         c."grade",
         c."description",
         c."academicYear",
         c."image",
         c."createdAt",
         c."updatedAt"
       ORDER BY array_position($5::text[], c."grade"::text), c."createdAt" ASC
       LIMIT $3 OFFSET $4`,
      [search, grade, limit, offset, DEFAULT_CLASSES.map((item) => item.grade)],
    );

    const countRow = await queryOne<{ total: number }>(
      `      SELECT COUNT(DISTINCT c."grade"::text)::int AS total
       FROM "classes" c
       WHERE c."grade"::text = ANY($3::text[])
         AND ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."grade"::text = $2)`,
      [search, grade, DEFAULT_CLASSES.map((item) => item.grade)],
    );

    const total = countRow?.total || 0;

    return jsonResponse({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Get classes error:', error);
    return serverError(
      error instanceof Error ? error.message : 'فشل جلب الفصول',
    );
  }
}

export async function POST() {
  return jsonResponse(
    { message: 'الفصول ثابتة ولا يمكن إضافة فصول جديدة' },
    405,
  );
}
