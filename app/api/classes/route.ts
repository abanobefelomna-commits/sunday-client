import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne, transaction } from '@/src/server/db';
import { ensureDefaultClasses } from '@/src/server/classes';
import { canManageClassStructure } from '@/src/server/access';
import { recordAudit, requestIp } from '@/src/server/audit';
import { requireTenantContext } from '@/src/server/tenant/context';
import { getAccessContext, getAuthUser, jsonResponse, serverError, unauthorized, badRequest, forbidden, conflict } from '@/src/server/middleware';
import { isUuid, requiredText } from '@/src/server/validation';

type ClassRecord = {
  id: string;
  name: string;
  grade: string;
  description: string | null;
  academicYear: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  childrenCount: number;
  servantsCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function GETHandler(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const access = await getAccessContext(user);
    const canManage = canManageClassStructure(access);
    await ensureDefaultClasses();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const grade = searchParams.get('grade') || null;
    const pageValue = Number.parseInt(searchParams.get('page') || '1', 10);
    const limitValue = Number.parseInt(searchParams.get('limit') || '50', 10);
    const page = Number.isFinite(pageValue) ? Math.max(1, pageValue) : 1;
    const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, limitValue)) : 50;
    const offset = (page - 1) * limit;
    const tenantId = requireTenantContext().churchId;
    const includeInactive = canManage && searchParams.get('includeInactive') === 'true';

    const data = await query<ClassRecord>(
      `SELECT
         c."id",
         c."name",
         c."grade",
         c."description",
         c."academicYear",
         c."image",
         c."isActive",
         c."sortOrder",
         c."createdAt",
         c."updatedAt",
         CASE WHEN c."grade"::text = 'general'
           THEN (SELECT COUNT(*)::int FROM "children" WHERE "deletedAt" IS NULL)
           ELSE COUNT(DISTINCT ch."id")::int
         END AS "childrenCount",
         COUNT(DISTINCT sc."servantsId")::int AS "servantsCount"
       FROM "classes" c
       LEFT JOIN "children" ch ON ch."classId" = c."id" AND ch."deletedAt" IS NULL
       LEFT JOIN "servants_classes" sc ON sc."classesId" = c."id"
       WHERE c."churchId" = $1
         AND c."deletedAt" IS NULL
         AND ($2::text IS NULL OR c."name" ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR c."grade"::text = $3)
         AND ($4::boolean OR c."isActive" = true)
       GROUP BY
         c."id",
         c."name",
         c."grade",
         c."description",
         c."academicYear",
         c."image",
         c."isActive",
         c."sortOrder",
         c."createdAt",
         c."updatedAt"
       ORDER BY c."sortOrder" ASC, c."createdAt" ASC, c."id" ASC
       LIMIT $5 OFFSET $6`,
      [tenantId, search, grade, includeInactive, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "classes" c
       WHERE c."churchId" = $1 AND c."deletedAt" IS NULL
         AND ($2::text IS NULL OR c."name" ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR c."grade"::text = $3)
         AND ($4::boolean OR c."isActive" = true)`,
      [tenantId, search, grade, includeInactive],
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

async function POSTHandler(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const access = await getAccessContext(user);
    if (!canManageClassStructure(access)) return forbidden();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات الفصل غير صالحة');
    }
    const name = requiredText(body.name, 'اسم الفصل', 160);
    const description =
      body.description === undefined || body.description === null
        ? null
        : requiredText(body.description, 'الوصف', 500);
    const tenantId = requireTenantContext().churchId;
    const duplicate = await queryOne<{ id: string }>(
      `SELECT "id" FROM "classes"
       WHERE "churchId" = $1 AND "deletedAt" IS NULL AND lower(trim("name")) = lower(trim($2))
       LIMIT 1`,
      [tenantId, name],
    );
    if (duplicate) return conflict('يوجد فصل بهذا الاسم بالفعل');

    const created = await queryOne<ClassRecord>(
      `INSERT INTO "classes"
         ("id", "churchId", "name", "nameKey", "grade", "description", "academicYear",
          "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT uuid_generate_v4(), $1, $2, lower(trim($2)), 'custom-' || replace(uuid_generate_v4()::text, '-', ''),
              $3, 'عام', true, COALESCE(MAX("sortOrder"), 0) + 1, now(), now()
       FROM "classes"
       WHERE "churchId" = $1 AND "deletedAt" IS NULL
       RETURNING "id", "name", "grade", "description", "academicYear", "image",
                 "isActive", "sortOrder", 0::int AS "childrenCount", 0::int AS "servantsCount",
                 "createdAt", "updatedAt"`,
      [tenantId, name, description],
    );
    if (!created) return serverError('تعذر إنشاء الفصل');

    await recordAudit({
      actorId: user.sub,
      action: 'class.create',
      entityType: 'class',
      entityId: created.id,
      after: { name: created.name, description: created.description, sortOrder: created.sortOrder },
      ip: requestIp(req),
    });
    return jsonResponse(created, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return badRequest(error.message);
    }
    if (isUniqueViolation(error)) return conflict('يوجد فصل بهذا الاسم بالفعل');
    console.error('Create class error:', error);
    return serverError('تعذر إنشاء الفصل');
  }
}

async function PATCHHandler(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const access = await getAccessContext(user);
    if (!canManageClassStructure(access)) return forbidden();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات ترتيب الفصول غير صالحة');
    }
    if (!Array.isArray(body.order) || !body.order.every(isUuid)) {
      return badRequest('ترتيب الفصول غير صالح');
    }
    const ids = body.order as string[];
    if (new Set(ids).size !== ids.length) return badRequest('لا يمكن تكرار الفصل في الترتيب');

    const tenantId = requireTenantContext().churchId;
    const current = await query<{ id: string }>(
      `SELECT "id" FROM "classes" WHERE "churchId" = $1 AND "deletedAt" IS NULL`,
      [tenantId],
    );
    if (current.length !== ids.length || current.some((item) => !ids.includes(item.id))) {
      return badRequest('أعد تحميل قائمة الفصول قبل تغيير الترتيب');
    }

    await transaction(
      ids.map((id, index) => ({
        text: `UPDATE "classes" SET "sortOrder" = $1, "updatedAt" = now()
               WHERE "id" = $2 AND "churchId" = $3 AND "deletedAt" IS NULL`,
        params: [index + 1, id, tenantId],
      })),
    );
    await recordAudit({
      actorId: user.sub,
      action: 'class.reorder',
      entityType: 'class',
      after: { ids },
      ip: requestIp(req),
    });
    return jsonResponse({ message: 'تم تحديث ترتيب الفصول' });
  } catch (error: unknown) {
    console.error('Reorder classes error:', error);
    return serverError('تعذر تحديث ترتيب الفصول');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
export const PATCH = withTenant(PATCHHandler);
