import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  canWriteClass,
  jsonResponse,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isUuid, isIsoDate, oneOf, optionalText } from '@/src/server/validation';

const GENDERS = ['male', 'female'] as const;

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const gender = oneOf(searchParams.get('gender'), GENDERS);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const grade = searchParams.get('grade') || null;
    const minAge = searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!, 10) : null;
    const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!, 10) : null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    if (!access.privileged && access.classIds.length === 0) {
      return jsonResponse({
        data: [],
        total: 0,
        meta: { total: 0, page, limit, totalPages: 0 },
      });
    }
    if (classId && !canReadClass(access, classId)) return forbidden();

    const scopeIds = access.privileged ? null : access.classIds;

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
      assignedServantId: string | null;
      assignedServantName: string | null;
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
         c."assignedServantId",
         c."createdAt",
         c."updatedAt",
         cls."name" AS "className",
         cls."grade" AS "classGrade",
         asg."name" AS "assignedServantName"
       FROM "children" c
       LEFT JOIN "classes" cls ON cls."id" = c."classId"
       LEFT JOIN "servants" asg ON asg."id" = c."assignedServantId"
       WHERE c."deletedAt" IS NULL
         AND ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%'
              OR c."parentPhone" ILIKE '%' || $1 || '%'
              OR c."phone" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."gender"::text = $2)
         AND ($3::uuid IS NULL OR c."classId" = $3)
         AND ($4::text IS NULL OR cls."grade"::text = $4)
         AND ($5::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) >= $5)
         AND ($6::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) <= $6)
         AND ($7::uuid[] IS NULL OR c."classId" = ANY($7::uuid[]))
       ORDER BY c."createdAt" DESC
       LIMIT $8 OFFSET $9`,
      [search, gender, classId, grade, minAge, maxAge, scopeIds, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "children" c
       LEFT JOIN "classes" cls ON cls."id" = c."classId"
       WHERE c."deletedAt" IS NULL
         AND ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%'
              OR c."parentPhone" ILIKE '%' || $1 || '%'
              OR c."phone" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c."gender"::text = $2)
         AND ($3::uuid IS NULL OR c."classId" = $3)
         AND ($4::text IS NULL OR cls."grade"::text = $4)
         AND ($5::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) >= $5)
         AND ($6::int IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, c."birthDate")) <= $6)
         AND ($7::uuid[] IS NULL OR c."classId" = ANY($7::uuid[]))`,
      [search, gender, classId, grade, minAge, maxAge, scopeIds],
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
      assignedServantId: r.assignedServantId,
      assignedServant: r.assignedServantId
        ? { id: r.assignedServantId, name: r.assignedServantName }
        : null,
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
  } catch (error: unknown) {
    console.error('Get children error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب قائمة الأطفال');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
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
      assignedServantId,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return badRequest('اسم الطفل مطلوب');
    }
    if (birthDate && !isIsoDate(birthDate)) return badRequest('تاريخ الميلاد غير صالح');
    if (!oneOf(gender, GENDERS)) return badRequest('النوع غير صالح');
    if (classId && !isUuid(classId)) return badRequest('معرّف الفصل غير صالح');
    if (assignedServantId && !isUuid(assignedServantId)) return badRequest('الخادم المسؤول غير صالح');

    const access = await getAccessContext(auth);
    if (!access.privileged && (!classId || !canWriteClass(access, classId))) return forbidden();

    if (assignedServantId) {
      const servant = await queryOne<{ id: string }>(
        `SELECT s."id" FROM "servants" s
         WHERE s."id" = $1
           AND (
             $2::uuid IS NULL
             OR EXISTS (SELECT 1 FROM "servants_classes" sc WHERE sc."servantsId" = s."id" AND sc."classesId" = $2)
           )
         LIMIT 1`,
        [assignedServantId, classId || null],
      );
      if (!servant) return badRequest('الخادم المسؤول غير معيّن على هذا الفصل');
    }

    const effectiveBirthDate =
      birthDate ||
      new Date(Date.now() - 8 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const newChild = await queryOne(
      `INSERT INTO "children" (
         "id", "name", "birthDate", "gender", "parentPhone", "parentName", "address", "notes", "classId", "phone", "avatar", "assignedServantId", "createdAt", "updatedAt"
       )
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       RETURNING *`,
      [
        name.trim(),
        effectiveBirthDate,
        gender,
        optionalText(parentPhone, 30),
        optionalText(parentName, 160),
        optionalText(address, 300),
        optionalText(notes, 1000),
        classId || null,
        optionalText(phone, 30),
        avatar || null,
        assignedServantId || null,
      ],
    );

    return jsonResponse(newChild, 201);
  } catch (error: unknown) {
    console.error('Create child error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إضافة الطفل');
  }
}
