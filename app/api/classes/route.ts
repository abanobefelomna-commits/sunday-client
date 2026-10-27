import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
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
       FROM "classes" c
       LEFT JOIN "children" ch ON ch."classId" = c."id"
       LEFT JOIN "servants_classes" sc ON sc."classesId" = c."id"
       WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."grade"::text = $2)
       GROUP BY c."id"
       ORDER BY c."createdAt" ASC
       LIMIT $3 OFFSET $4`,
      [search, grade, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "classes" c
       WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."grade"::text = $2)`,
      [search, grade],
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
  } catch (error: any) {
    console.error('Get classes error:', error);
    return serverError(error.message || 'فشل جلب الفصول');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    // Allow request (or require auth if desired)
    const body = await req.json();
    const { name, grade, description = '', academicYear = '' } = body;

    if (!name || !grade) {
      return badRequest('اسم الفصل والدرجة مطلوبة');
    }

    const newClass = await queryOne<{
      id: string;
      name: string;
      grade: string;
      description: string | null;
      academicYear: string | null;
      image: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `INSERT INTO "classes" ("id", "name", "grade", "description", "academicYear", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, now(), now())
       RETURNING *`,
      [name, grade, description, academicYear],
    );

    return jsonResponse(newClass, 201);
  } catch (error: any) {
    console.error('Create class error:', error);
    return serverError(error.message || 'فشل إنشاء الفصل');
  }
}
