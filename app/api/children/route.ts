import { query, queryOne } from '@/src/server/db';
import { jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const gender = searchParams.get('gender') || null;
    const classId = searchParams.get('classId') || null;
    const grade = searchParams.get('grade') || null;
    const minAge = searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!, 10) : null;
    const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!, 10) : null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const rows = await query<{
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
       WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."gender"::text = $2)
         AND ($3::uuid IS NULL OR c."classId" = $3)
         AND ($4::text IS NULL OR cls."grade"::text = $4)
         AND ($5::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) >= $5)
         AND ($6::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) <= $6)
       ORDER BY c."createdAt" DESC
       LIMIT $7 OFFSET $8`,
      [search, gender, classId, grade, minAge, maxAge, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "children" c
       LEFT JOIN "classes" cls ON cls."id" = c."classId"
       WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."gender"::text = $2)
         AND ($3::uuid IS NULL OR c."classId" = $3)
         AND ($4::text IS NULL OR cls."grade"::text = $4)
         AND ($5::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) >= $5)
         AND ($6::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) <= $6)`,
      [search, gender, classId, grade, minAge, maxAge],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      birthDate: r.birthDate,
      gender: r.gender,
      parentPhone: r.parentPhone,
      parentName: r.parentName,
      address: r.address,
      notes: r.notes,
      phone: r.phone,
      avatar: r.avatar,
      classId: r.classId,
      class: r.classId
        ? {
            id: r.classId,
            name: r.className,
            grade: r.classGrade,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
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
    console.error('Get children error:', error);
    return serverError(error.message || 'فشل جلب قائمة الأطفال');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      birthDate,
      gender = 'male',
      parentPhone = '',
      parentName,
      address,
      notes,
      classId,
      phone,
      avatar,
    } = body;

    if (!name || !birthDate) {
      return badRequest('اسم الطفل وتاريخ الميلاد مطلوبان');
    }

    const newChild = await queryOne(
      `INSERT INTO "children" (
         "id", "name", "birthDate", "gender", "parentPhone", "parentName", "address", "notes", "classId", "phone", "avatar", "createdAt", "updatedAt"
       )
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       RETURNING *`,
      [
        name,
        birthDate,
        gender,
        parentPhone,
        parentName || null,
        address || null,
        notes || null,
        classId || null,
        phone || null,
        avatar || null,
      ],
    );

    return jsonResponse(newChild, 201);
  } catch (error: any) {
    console.error('Create child error:', error);
    return serverError(error.message || 'فشل إضافة الطفل');
  }
}
