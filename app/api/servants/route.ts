import { query, queryOne } from '@/src/server/db';
import { jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const role = searchParams.get('role') || null;
    const phone = searchParams.get('phone') || null;
    const classId = searchParams.get('classId') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const servants = await query<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      role: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT DISTINCT
         s."id",
         s."name",
         s."phone",
         s."email",
         s."role",
         s."avatar",
         s."createdAt",
         s."updatedAt"
       FROM "servants" s
       LEFT JOIN "servants_classes" sc ON sc."servantsId" = s."id"
       WHERE ($1::text IS NULL OR s."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR s."role"::text = $2)
         AND ($3::text IS NULL OR s."phone" ILIKE '%' || $3 || '%')
         AND ($4::uuid IS NULL OR sc."classesId" = $4)
       ORDER BY s."createdAt" DESC
       LIMIT $5 OFFSET $6`,
      [search, role, phone, classId, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(DISTINCT s."id")::int AS total
       FROM "servants" s
       LEFT JOIN "servants_classes" sc ON sc."servantsId" = s."id"
       WHERE ($1::text IS NULL OR s."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR s."role"::text = $2)
         AND ($3::text IS NULL OR s."phone" ILIKE '%' || $3 || '%')
         AND ($4::uuid IS NULL OR sc."classesId" = $4)`,
      [search, role, phone, classId],
    );

    const total = countRow?.total || 0;

    // Attach classes to each servant
    const servantIds = servants.map((s) => s.id);
    let classesMap: Record<string, Array<{ id: string; name: string; grade: string }>> = {};

    if (servantIds.length > 0) {
      const classRows = await query<{
        servantId: string;
        classId: string;
        className: string;
        classGrade: string;
      }>(
        `SELECT
           sc."servantsId" AS "servantId",
           c."id" AS "classId",
           c."name" AS "className",
           c."grade" AS "classGrade"
         FROM "servants_classes" sc
         JOIN "classes" c ON c."id" = sc."classesId"
         WHERE sc."servantsId" = ANY($1::uuid[])`,
        [servantIds],
      );

      for (const row of classRows) {
        if (!classesMap[row.servantId]) {
          classesMap[row.servantId] = [];
        }
        classesMap[row.servantId].push({
          id: row.classId,
          name: row.className,
          grade: row.classGrade,
        });
      }
    }

    const data = servants.map((s) => ({
      ...s,
      classes: classesMap[s.id] || [],
    }));

    return jsonResponse({
      data,
      total,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get servants error:', error);
    return serverError(error.message || 'فشل جلب قائمة الخدام');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, email, role = 'خادم', classIds = [] } = body;

    if (!name || !phone) {
      return badRequest('الاسم ورقم الهاتف مطلوبان');
    }

    const newServant = await queryOne<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      role: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `INSERT INTO "servants" ("id", "name", "phone", "email", "role", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, now(), now())
       RETURNING *`,
      [name, phone, email || null, role],
    );

    if (!newServant) {
      return serverError('فشل إنشاء الخادم');
    }

    if (Array.isArray(classIds) && classIds.length > 0) {
      for (const cId of classIds) {
        await query(
          `INSERT INTO "servants_classes" ("servantsId", "classesId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [newServant.id, cId],
        );
      }
    }

    return jsonResponse(newServant, 201);
  } catch (error: any) {
    console.error('Create servant error:', error);
    return serverError(error.message || 'فشل إضافة الخادم');
  }
}
