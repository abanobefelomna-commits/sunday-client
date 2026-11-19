import { withTenant } from '@/src/server/tenant/route';
import { query, transaction } from '@/src/server/db';
import { requireTenantContext } from '@/src/server/tenant/context';
import { canManagePromotions } from '@/src/server/access';
import { recordAudit, requestIp } from '@/src/server/audit';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from '@/src/server/middleware';
import { isUuid } from '@/src/server/validation';

type PromotionInput = { childId: string; toClassId: string };

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!canManagePromotions(access)) {
      return forbidden('إدارة الترقية متاحة للمسؤول والكاهن والمسؤولين المصرح لهم فقط');
    }

    const tenantId = requireTenantContext().churchId;
    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    const history = searchParams.get('history') === 'true';
    const academicYear = searchParams.get('academicYear')?.trim().slice(0, 20) || null;
    const childId = isUuid(searchParams.get('childId')) ? searchParams.get('childId') : null;

    const classes = await query<{
      id: string;
      name: string;
      grade: string;
      academicYear: string | null;
      sortOrder: number;
    }>(
      `SELECT "id", "name", "grade", "academicYear", "sortOrder"
       FROM "classes"
       WHERE "churchId" = $1 AND "deletedAt" IS NULL
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      [tenantId],
    );

    let children: Array<{
      id: string;
      name: string;
      birthDate: string;
      classId: string | null;
      className: string | null;
    }> = [];

    if (classId) {
      children = await query(
        `SELECT ch."id", ch."name", ch."birthDate"::text AS "birthDate",
                ch."classId", c."name" AS "className"
         FROM "children" ch
         LEFT JOIN "classes" c ON c."id" = ch."classId"
         WHERE ch."deletedAt" IS NULL
           AND ch."classId" = $1
         ORDER BY ch."name" ASC`,
        [classId],
      );
    }

    const promotionHistory = history
      ? await query<{
          id: string;
          childId: string;
          childName: string;
          fromClassId: string | null;
          fromClassName: string | null;
          toClassId: string | null;
          toClassName: string | null;
          academicYear: string;
          promotedBy: string | null;
          promotedByName: string | null;
          promotedAt: Date;
        }>(
          `SELECT p."id", p."childId", ch."name" AS "childName",
                  p."fromClassId", fc."name" AS "fromClassName",
                  p."toClassId", tc."name" AS "toClassName",
                  p."academicYear", p."promotedBy", u."name" AS "promotedByName",
                  p."promotedAt"
           FROM "class_promotions" p
           JOIN "children" ch ON ch."id" = p."childId"
           LEFT JOIN "classes" fc ON fc."id" = p."fromClassId"
           LEFT JOIN "classes" tc ON tc."id" = p."toClassId"
           LEFT JOIN "users" u ON u."id" = p."promotedBy"
           WHERE ($1::text IS NULL OR p."academicYear" = $1)
             AND ($2::uuid IS NULL OR p."childId" = $2)
           ORDER BY p."promotedAt" DESC
           LIMIT 500`,
          [academicYear, childId],
        )
      : [];

    return jsonResponse({
      classes,
      children,
      history: promotionHistory,
    });
  } catch (error: unknown) {
    console.error('Get promotions error:', error);
    return serverError('فشل جلب بيانات الترقية');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!canManagePromotions(access)) {
      return forbidden('إدارة الترقية متاحة للمسؤول والكاهن والمسؤولين المصرح لهم فقط');
    }

    let body: { academicYear?: unknown; promotions?: unknown };
    try {
      body = await req.json();
    } catch {
      return badRequest('بيانات الترقية غير صالحة');
    }

    const academicYear =
      typeof body.academicYear === 'string' ? body.academicYear.trim().slice(0, 20) : '';
    if (!academicYear) return badRequest('العام الدراسي مطلوب');
    if (!Array.isArray(body.promotions) || body.promotions.length === 0) {
      return badRequest('اختر طفلًا واحدًا على الأقل للترقية');
    }
    if (body.promotions.length > 500) {
      return badRequest('لا يمكن ترقية أكثر من 500 طفل في عملية واحدة');
    }

    const promotions: PromotionInput[] = [];
    const seenChildren = new Set<string>();
    for (const entry of body.promotions) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !isUuid((entry as PromotionInput).childId) ||
        !isUuid((entry as PromotionInput).toClassId)
      ) {
        return badRequest('بيانات أحد الأطفال غير صالحة');
      }
      const childId = (entry as PromotionInput).childId;
      if (seenChildren.has(childId)) {
        return badRequest('لا يمكن تكرار نفس الطفل في عملية الترقية');
      }
      seenChildren.add(childId);
      promotions.push({
        childId,
        toClassId: (entry as PromotionInput).toClassId,
      });
    }

    const tenantId = requireTenantContext().churchId;
    const childIds = promotions.map((item) => item.childId);
    const toClassIds = [...new Set(promotions.map((item) => item.toClassId))];

    const children = await query<{ id: string; name: string; classId: string | null }>(
      `SELECT "id", "name", "classId"
       FROM "children"
       WHERE "id" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
      [childIds],
    );
    const childMap = new Map(children.map((child) => [child.id, child]));
    if (children.length !== childIds.length) {
      return notFound('أحد الأطفال غير موجود');
    }

    const validClasses = await query<{ id: string }>(
      `SELECT "id" FROM "classes"
       WHERE "id" = ANY($1::uuid[]) AND "churchId" = $2 AND "deletedAt" IS NULL`,
      [toClassIds, tenantId],
    );
    if (validClasses.length !== toClassIds.length) {
      return badRequest('أحد الفصول المستقبلة غير صالح');
    }

    for (const promotion of promotions) {
      const child = childMap.get(promotion.childId);
      if (!child) return notFound('أحد الأطفال غير موجود');
      if (child.classId === promotion.toClassId) {
        return badRequest('لا يمكن ترقية الطفل إلى نفس الفصل');
      }
    }

    const statements = promotions.flatMap((promotion) => {
      const child = childMap.get(promotion.childId);
      return [
        {
          text: `UPDATE "children"
                 SET "classId" = $1, "updatedAt" = now()
                 WHERE "id" = $2 AND "deletedAt" IS NULL`,
          params: [promotion.toClassId, promotion.childId],
        },
        {
          text: `INSERT INTO "class_promotions"
                   ("id", "childId", "fromClassId", "toClassId", "academicYear",
                    "promotedBy", "promotedAt", "createdAt")
                 VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), now())`,
          params: [
            promotion.childId,
            child?.classId ?? null,
            promotion.toClassId,
            academicYear,
            auth.sub,
          ],
        },
      ];
    });

    await transaction(statements);

    await recordAudit({
      actorId: auth.sub,
      action: 'children.promote',
      entityType: 'class_promotion',
      after: { academicYear, count: promotions.length },
      ip: requestIp(req),
    });

    return jsonResponse({
      message: `تمت ترقية ${promotions.length} طفلًا بنجاح`,
      promoted: promotions.length,
      academicYear,
    });
  } catch (error: unknown) {
    console.error('Promote children error:', error);
    return serverError('تعذر تنفيذ الترقية');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
