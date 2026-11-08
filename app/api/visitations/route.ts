import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canManageServants,
  canReadClass,
  jsonResponse,
  badRequest,
  serverError,
  unauthorized,
  forbidden,
} from '@/src/server/middleware';
import { isIsoDate, isUuid, oneOf } from '@/src/server/validation';

const VISIT_TYPES = ['home_visit', 'phone_call', 'church_meeting', 'other'] as const;
const VISIT_STATUSES = ['planned', 'completed', 'cancelled'] as const;

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const childId = isUuid(searchParams.get('childId')) ? searchParams.get('childId') : null;
    const servantId = isUuid(searchParams.get('servantId')) ? searchParams.get('servantId') : null;
    const type = oneOf(searchParams.get('type'), VISIT_TYPES);
    const status = oneOf(searchParams.get('status'), VISIT_STATUSES);
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    if (!access.privileged && access.classIds.length === 0) {
      return jsonResponse({ data: [], total: 0, meta: { total: 0, page, limit, totalPages: 0 } });
    }
    if (childId) {
      const child = await queryOne<{ classId: string | null }>(
        `SELECT "classId" FROM "children" WHERE "id" = $1 LIMIT 1`,
        [childId],
      );
      if (!child) return jsonResponse({ data: [], total: 0, meta: { total: 0, page, limit, totalPages: 0 } });
      if (!canReadClass(access, child.classId)) return forbidden();
    }

    const scopeIds = access.privileged ? null : access.classIds;

    const rows = await query<{
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
      `SELECT v."id", v."childId", v."servantId", v."date"::text AS "date",
              v."type"::text AS "type", v."status"::text AS "status", v."notes",
              v."followUpDate"::text AS "followUpDate", v."createdAt", v."updatedAt",
              c."name" AS "childName", s."name" AS "servantName"
       FROM "visitations" v
       LEFT JOIN "children" c ON c."id" = v."childId"
       LEFT JOIN "servants" s ON s."id" = v."servantId"
       WHERE ($1::uuid IS NULL OR v."childId" = $1)
         AND ($2::uuid IS NULL OR v."servantId" = $2)
         AND ($3::text IS NULL OR v."type"::text = $3)
         AND ($4::text IS NULL OR v."status"::text = $4)
         AND ($5::date IS NULL OR v."date" >= $5)
         AND ($6::date IS NULL OR v."date" <= $6)
         AND ($7::uuid[] IS NULL OR c."classId" = ANY($7::uuid[]))
       ORDER BY v."date" DESC
       LIMIT $8 OFFSET $9`,
      [childId, servantId, type, status, dateFrom, dateTo, scopeIds, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "visitations" v
       LEFT JOIN "children" c ON c."id" = v."childId"
       WHERE ($1::uuid IS NULL OR v."childId" = $1)
         AND ($2::uuid IS NULL OR v."servantId" = $2)
         AND ($3::text IS NULL OR v."type"::text = $3)
         AND ($4::text IS NULL OR v."status"::text = $4)
         AND ($5::date IS NULL OR v."date" >= $5)
         AND ($6::date IS NULL OR v."date" <= $6)
         AND ($7::uuid[] IS NULL OR c."classId" = ANY($7::uuid[]))`,
      [childId, servantId, type, status, dateFrom, dateTo, scopeIds],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      servantId: r.servantId,
      date: r.date,
      type: r.type,
      status: r.status,
      notes: r.notes,
      followUpDate: r.followUpDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      child: { id: r.childId, name: r.childName },
      servant: r.servantId ? { id: r.servantId, name: r.servantName } : null,
    }));

    return jsonResponse({
      data,
      total,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    console.error('Get visitations error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب سجلات الافتقاد');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    if (!(await canManageServants(auth))) return forbidden('حجز الزيارات متاح للمسؤول والكاهن فقط');

    const body = await req.json();
    const {
      childId,
      servantId,
      date,
      type = 'home_visit',
      status = 'completed',
      notes,
      followUpDate,
    } = body ?? {};

    if (!isUuid(childId) || !isIsoDate(date)) {
      return badRequest('الطفل والتاريخ مطلوبان');
    }
    if (!oneOf(type, VISIT_TYPES) || !oneOf(status, VISIT_STATUSES)) {
      return badRequest('نوع أو حالة الافتقاد غير صالحة');
    }
    if (servantId !== undefined && servantId !== null && !isUuid(servantId)) {
      return badRequest('معرّف الخادم غير صالح');
    }
    if (followUpDate !== undefined && followUpDate !== null && !isIsoDate(followUpDate)) {
      return badRequest('تاريخ المتابعة غير صالح');
    }

    const access = await getAccessContext(auth);
    const child = await queryOne<{ classId: string | null }>(
      `SELECT "classId" FROM "children" WHERE "id" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [childId],
    );
    if (!child) return badRequest('الطفل غير موجود');
    if (!canReadClass(access, child.classId)) return forbidden();

    const created = await queryOne(
      `INSERT INTO "visitations" (
         "id", "childId", "servantId", "date", "type", "status", "notes", "followUpDate", "createdAt", "updatedAt"
       )
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [childId, servantId || null, date, type, status, notes || null, followUpDate || null],
    );

    return jsonResponse(created, 201);
  } catch (error: unknown) {
    console.error('Create visitation error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تسجيل الافتقاد');
  }
}
