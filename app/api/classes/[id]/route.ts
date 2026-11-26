import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { canManageClassStructure } from '@/src/server/access';
import { recordAudit, requestIp } from '@/src/server/audit';
import { requireTenantContext } from '@/src/server/tenant/context';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  effectiveClassIds,
  hasBroadClassRead,
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
      leadServantId?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT "id", "name", "grade", "description", "academicYear", "image",
              "isActive", "sortOrder", "leadServantId", "createdAt", "updatedAt"
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
       ORDER BY (s."id" = $2::uuid) DESC NULLS LAST,
                (s."role" = 'قائد فصل') DESC,
                s."name" ASC`,
      [id, cls.leadServantId ?? null],
    );

    let leadServant: { id: string; name: string } | null = null;
    if (cls.leadServantId) {
      leadServant = await queryOne<{ id: string; name: string }>(
        `SELECT "id", "name" FROM "servants" WHERE "id" = $1 LIMIT 1`,
        [cls.leadServantId],
      );
    }

    const isGeneral = cls.grade === 'general';
    let childrenQuery = `SELECT "id", "name", "birthDate", "gender", "parentPhone", "phone", "avatar"
       FROM "children" WHERE "deletedAt" IS NULL`;
    const childrenParams: unknown[] = [];

    if (isGeneral) {
      // The general group lists every child, which would leak children from
      // classes the current servant cannot read. Scoped users only see the
      // children of their own readable classes; broad-read churches keep the
      // legacy behaviour.
      if (!access.privileged && !hasBroadClassRead(access)) {
        childrenQuery += ` AND "classId" = ANY($1::uuid[])`;
        childrenParams.push(effectiveClassIds(access));
      }
    } else {
      childrenQuery += ` AND "classId" = $1`;
      childrenParams.push(id);
    }
    childrenQuery += ` ORDER BY "name" ASC`;

    const children = await query<{
      id: string;
      name: string;
      birthDate: string;
      gender: string;
      parentPhone: string | null;
      phone: string | null;
      avatar: string | null;
    }>(childrenQuery, childrenParams);

    return jsonResponse({
      ...cls,
      leadServant,
      servants,
      children,
      childrenCount: children.length,
      servantsCount: servants.length,
    });
  } catch (error: unknown) {
    console.error('Get class details error:', error);
    return serverError('فشل جلب تفاصيل الفصل');
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
    const hasLeadServantId = Object.hasOwn(body, 'leadServantId');
    if (!hasName && !hasDescription && !hasIsActive && !hasSortOrder && !hasLeadServantId) {
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

    let leadServantId: string | null = null;
    if (hasLeadServantId) {
      if (body.leadServantId !== null && !isUuid(body.leadServantId)) {
        return badRequest('معرّف قائد الفصل غير صالح');
      }
      leadServantId = typeof body.leadServantId === 'string' ? body.leadServantId : null;
      if (leadServantId) {
        const member = await queryOne<{ id: string; role: string; otherLeadClassId: string | null }>(
          `SELECT s."id",
                  s."role"::text AS "role",
                  (SELECT c2."id" FROM "classes" c2
                   WHERE c2."leadServantId" = s."id" AND c2."id" <> $2
                   LIMIT 1) AS "otherLeadClassId"
           FROM "servants" s
           JOIN "servants_classes" sc ON sc."servantsId" = s."id"
           WHERE s."id" = $1 AND sc."classesId" = $2
           LIMIT 1`,
          [leadServantId, id],
        );
        if (!member) return badRequest('قائد الفصل يجب أن يكون خادمًا معيّنًا لهذا الفصل');
        if (['مسؤول', 'أب كاهن'].includes(member.role)) {
          return badRequest('لا يمكن تعيين مسؤول أو كاهن قائدًا لفصل');
        }
        if (member.otherLeadClassId) {
          return conflict('هذا الخادم قائد لفصل آخر بالفعل');
        }
      }
    }

    const tenantId = requireTenantContext().churchId;
    const before = await queryOne<{ id: string; name: string; description: string | null; isActive: boolean; sortOrder: number; leadServantId?: string | null }>(
      `SELECT "id", "name", "description", "isActive", "sortOrder", "leadServantId"
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
           "leadServantId" = CASE WHEN $9::boolean THEN $10::uuid ELSE "leadServantId" END,
           "updatedAt" = now()
       WHERE "id" = $1 AND "churchId" = $8 AND "deletedAt" IS NULL
       RETURNING "id", "name", "grade", "description", "academicYear", "image",
                 "isActive", "sortOrder", "leadServantId", "createdAt", "updatedAt"`,
      [
        id,
        name,
        hasName,
        hasDescription,
        description,
        hasIsActive ? body.isActive : null,
        hasSortOrder ? body.sortOrder : null,
        tenantId,
        hasLeadServantId,
        leadServantId,
      ],
    );
    if (!updated) return notFound('الفصل غير موجود');

    if (hasLeadServantId) {
      if (before.leadServantId && before.leadServantId !== leadServantId) {
        await query(
          `UPDATE "servants" SET "role" = 'خادم', "updatedAt" = now()
           WHERE "id" = $1 AND "role"::text = 'قائد فصل'
             AND NOT EXISTS (SELECT 1 FROM "classes" WHERE "leadServantId" = $1)`,
          [before.leadServantId],
        );
      }
      if (leadServantId) {
        await query(
          `UPDATE "servants" SET "role" = 'قائد فصل', "updatedAt" = now() WHERE "id" = $1`,
          [leadServantId],
        );
      }
    }
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
