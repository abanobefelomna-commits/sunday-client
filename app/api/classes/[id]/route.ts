import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { canManageClassStructure } from '@/src/server/access';
import { recordAudit, requestIp } from '@/src/server/audit';
import { requireTenantContext } from '@/src/server/tenant/context';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  jsonResponse,
  notFound,
  forbidden,
  serverError,
  unauthorized,
  badRequest,
  conflict,
} from '@/src/server/middleware';
import { isUuid, requiredText } from '@/src/server/validation';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الفصل غير صالح');

    const access = await getAccessContext(user);
    if (!canReadClass(access, id)) return forbidden();
    const tenantId = requireTenantContext().churchId;

    const cls = await queryOne<{
      id: string;
      name: string;
      grade: string;
      description: string | null;
      academicYear: string | null;
      image: string | null;
      isActive: boolean;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT "id", "name", "grade", "description", "academicYear", "image",
              "isActive", "sortOrder", "createdAt", "updatedAt"
       FROM "classes"
       WHERE "id" = $1 AND "churchId" = $2 AND "deletedAt" IS NULL
       LIMIT 1`,
      [id, tenantId],
    );

    if (!cls || (!cls.isActive && !canManageClassStructure(access))) {
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
      `SELECT s."id", s."name", s."phone", s."email", s."role"::text AS "role", s."avatar"
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
           FROM "children" WHERE "deletedAt" IS NULL ORDER BY "name" ASC`
        : `SELECT "id", "name", "birthDate", "gender", "parentPhone", "phone", "avatar"
           FROM "children" WHERE "classId" = $1 AND "deletedAt" IS NULL ORDER BY "name" ASC`,
      isGeneral ? [] : [id],
    );

    return jsonResponse({
      ...cls,
      servants,
      children,
      childrenCount: children.length,
      servantsCount: servants.length,
    });
  } catch (error: unknown) {
    console.error('Get class details error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب تفاصيل الفصل');
  }
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const access = await getAccessContext(user);
    if (!canManageClassStructure(access)) return forbidden();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الفصل غير صالح');

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات الفصل غير صالحة');
    }

    const hasName = Object.hasOwn(body, 'name');
    const hasDescription = Object.hasOwn(body, 'description');
    const hasIsActive = Object.hasOwn(body, 'isActive');
    const hasSortOrder = Object.hasOwn(body, 'sortOrder');
    if (!hasName && !hasDescription && !hasIsActive && !hasSortOrder) {
      return badRequest('لا توجد تغييرات لحفظها');
    }

    const name = hasName ? requiredText(body.name, 'اسم الفصل', 160) : null;
    let description: string | null = null;
    if (hasDescription) {
      if (body.description !== null && typeof body.description !== 'string') {
        return badRequest('الوصف غير صالح');
      }
      if (typeof body.description === 'string' && body.description.length > 500) {
        return badRequest('الوصف أطول من الحد المسموح (500 حرف)');
      }
      description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (hasIsActive && typeof body.isActive !== 'boolean') {
      return badRequest('حالة الفصل غير صالحة');
    }
    if (
      hasSortOrder &&
      (!Number.isInteger(body.sortOrder) || (body.sortOrder as number) < 0 || (body.sortOrder as number) > 100_000)
    ) {
      return badRequest('ترتيب الفصل غير صالح');
    }

    const tenantId = requireTenantContext().churchId;
    const before = await queryOne<{ id: string; name: string; description: string | null; isActive: boolean; sortOrder: number }>(
      `SELECT "id", "name", "description", "isActive", "sortOrder"
       FROM "classes" WHERE "id" = $1 AND "churchId" = $2 AND "deletedAt" IS NULL
       LIMIT 1`,
      [id, tenantId],
    );
    if (!before) return notFound('الفصل غير موجود');

    if (name) {
      const duplicate = await queryOne<{ id: string }>(
        `SELECT "id" FROM "classes"
         WHERE "churchId" = $1 AND "deletedAt" IS NULL
           AND lower(trim("name")) = lower(trim($2)) AND "id" <> $3
         LIMIT 1`,
        [tenantId, name, id],
      );
      if (duplicate) return conflict('يوجد فصل بهذا الاسم بالفعل');
    }

    const updated = await queryOne(
      `UPDATE "classes"
       SET "name" = COALESCE($2, "name"),
           "nameKey" = CASE WHEN $3::boolean THEN lower(trim($2)) ELSE "nameKey" END,
           "description" = CASE WHEN $4::boolean THEN $5 ELSE "description" END,
           "isActive" = COALESCE($6, "isActive"),
           "sortOrder" = COALESCE($7, "sortOrder"),
           "updatedAt" = now()
       WHERE "id" = $1 AND "churchId" = $8 AND "deletedAt" IS NULL
       RETURNING "id", "name", "grade", "description", "academicYear", "image",
                 "isActive", "sortOrder", "createdAt", "updatedAt"`,
      [
        id,
        name,
        hasName,
        hasDescription,
        description,
        hasIsActive ? body.isActive : null,
        hasSortOrder ? body.sortOrder : null,
        tenantId,
      ],
    );
    await recordAudit({
      actorId: user.sub,
      action: 'class.update',
      entityType: 'class',
      entityId: id,
      before,
      after: updated,
      ip: requestIp(req),
    });
    return jsonResponse(updated);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return badRequest(error.message);
    }
    if (isUniqueViolation(error)) return conflict('يوجد فصل بهذا الاسم بالفعل');
    console.error('Update class error:', error);
    return serverError('تعذر تحديث الفصل');
  }
}

async function DELETEHandler() {
  return conflict('لا يمكن حذف الفصول؛ أوقف الفصل للحفاظ على السجلات التاريخية');
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
