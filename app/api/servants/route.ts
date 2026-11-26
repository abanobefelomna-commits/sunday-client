import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { DEFAULT_CLASSES, ensureDefaultClasses } from '@/src/server/classes';
import {
  getAuthUser,
  getAccessContext,
  canAssignServantRole,
  isClassLeaderAccess,
  jsonResponse,
  badRequest,
  serverError,
  unauthorized,
  forbidden,
} from '@/src/server/middleware';
import {
  claimClassLeadership,
  isPrivilegedServantRole,
  normalizeServantRole,
  reconcileServantLeadership,
  servantRoleLabel,
} from '@/src/server/servants';
import { isUuid } from '@/src/server/validation';
import { canManagePrivilegedServants } from '@/src/server/access';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === 'string' && UUID_RE.test(item)),
    ),
  ];
}

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    await ensureDefaultClasses();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('name') || null;
    const role = searchParams.get('role') || null;
    const phone = searchParams.get('phone') || null;
    const rawClassId = searchParams.get('classId');
    if (rawClassId && !isUuid(rawClassId)) return badRequest('معرّف الفصل غير صالح');
    const classId = rawClassId || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    // Non-privileged users without broad read only see servants in their
    // effective class scope. Class leaders are always limited to led classes.
    const effectiveScope =
      access.privileged ||
      (access.readAllClasses === true && !isClassLeaderAccess(access))
        ? null
        : (access.ledClassIds && access.ledClassIds.length > 0
            ? access.ledClassIds
            : access.classIds);

    if (!access.privileged && classId) {
      const allowed = effectiveScope === null || effectiveScope.includes(classId);
      if (!allowed) return forbidden('غير مسموح بعرض خدام هذا الفصل');
    }

    if (effectiveScope !== null && effectiveScope.length === 0) {
      return jsonResponse({
        data: [],
        total: 0,
        meta: { total: 0, page, limit, totalPages: 0 },
      });
    }

    const scopeFilter = effectiveScope === null ? null : effectiveScope;

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
         AND ($7::uuid[] IS NULL OR EXISTS (
           SELECT 1 FROM "servants_classes" sc2
           WHERE sc2."servantsId" = s."id" AND sc2."classesId" = ANY($7::uuid[])
         ))
       ORDER BY s."createdAt" DESC
       LIMIT $5 OFFSET $6`,
      [search, role, phone, classId, limit, offset, scopeFilter],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(DISTINCT s."id")::int AS total
       FROM "servants" s
       LEFT JOIN "servants_classes" sc ON sc."servantsId" = s."id"
       WHERE ($1::text IS NULL OR s."name" ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR s."role"::text = $2)
         AND ($3::text IS NULL OR s."phone" ILIKE '%' || $3 || '%')
         AND ($4::uuid IS NULL OR sc."classesId" = $4)
         AND ($5::uuid[] IS NULL OR EXISTS (
           SELECT 1 FROM "servants_classes" sc2
           WHERE sc2."servantsId" = s."id" AND sc2."classesId" = ANY($5::uuid[])
         ))`,
      [search, role, phone, classId, scopeFilter],
    );

    const total = countRow?.total || 0;

    // Attach classes to each servant
    const servantIds = servants.map((s) => s.id);
    const classesMap: Record<string, Array<{ id: string; name: string; grade: string }>> = {};

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
  } catch (error: unknown) {
    console.error('Get servants error:', error);
    return serverError('فشل جلب قائمة الخدام');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const broadManager =
      access.privileged || access.permissions?.includes('servants.write') === true;
    if (!broadManager && !isClassLeaderAccess(access)) {
      return forbidden('إدارة الخدام متاحة للمسؤول والكاهن وقائد الفصل فقط');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('بيانات غير صالحة');
    const { name, phone, email, role = 'خادم', classIds = [] } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim() || typeof phone !== 'string' || !phone.trim()) {
      return badRequest('الاسم ورقم الهاتف مطلوبان');
    }

    const roleCode = normalizeServantRole(role);
    if (!roleCode) {
      return badRequest('صفة الخدمة غير صالحة');
    }
    if (!canAssignServantRole(access, roleCode)) {
      return forbidden('غير مسموح بتعيين هذه الصفة');
    }
    const roleLabel = servantRoleLabel(roleCode);

    if (isPrivilegedServantRole(roleCode) && !canManagePrivilegedServants(access)) {
      return forbidden('إضافة مسؤول أو أب كاهن متاحة للمسؤول والكاهن فقط');
    }

    await ensureDefaultClasses();
    let assignedClassIds: string[] = [];

    if (roleCode === 'general_servant') {
      const generalClass = await queryOne<{ id: string }>(
        `SELECT "id" FROM "classes" WHERE "grade"::text = 'general' LIMIT 1`,
      );
      if (!generalClass) {
        return serverError('فشل تجهيز فصل الفقرة العامة');
      }
      assignedClassIds = [generalClass.id];
    } else if (roleCode === 'servant' || roleCode === 'class_leader') {
      const requestedClassIds = validUuidList(classIds);
      if (requestedClassIds.length !== 1) {
        return badRequest('اختر فصلًا واحدًا للخادم');
      }

      if (!broadManager) {
        const led = access.ledClassIds ?? [];
        if (!led.includes(requestedClassIds[0])) {
          return forbidden('غير مسموح بإضافة خادم خارج فصلك');
        }
      }

      const selectedClass = await queryOne<{ id: string; leadServantId: string | null }>(
        `SELECT "id", "leadServantId" FROM "classes"
         WHERE "id" = $1 AND "grade"::text = ANY($2::text[])
         LIMIT 1`,
        [requestedClassIds[0], DEFAULT_CLASSES.map((item) => item.grade)],
      );
      if (!selectedClass) {
        return badRequest('الفصل المختار غير صالح');
      }
      if (roleCode === 'class_leader' && selectedClass.leadServantId) {
        return forbidden('هذا الفصل لديه قائد بالفعل');
      }
      assignedClassIds = [selectedClass.id];
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
      [name.trim(), phone.trim(), typeof email === 'string' && email.trim() ? email.trim() : null, roleLabel],
    );

    if (!newServant) {
      return serverError('فشل إنشاء الخادم');
    }

    if (roleCode === 'admin' || roleCode === 'priest') {
      assignedClassIds = [];
    }

    if (assignedClassIds.length > 0) {
      for (const cId of assignedClassIds) {
        await query(
          `INSERT INTO "servants_classes" ("servantsId", "classesId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [newServant.id, cId],
        );
      }
    }

    // A class leader serves exactly one class. Claim the vacant slot; a race
    // with another request rolls the new row back instead of leaving an
    // unassigned "class leader" behind.
    if (roleCode === 'class_leader' && assignedClassIds.length === 1) {
      const claimed = await claimClassLeadership(newServant.id, assignedClassIds[0]);
      if (!claimed) {
        await query(`DELETE FROM "servants" WHERE "id" = $1`, [newServant.id]);
        return forbidden('تم تعيين قائد لهذا الفصل بالفعل');
      }
    }

    await reconcileServantLeadership(newServant.id, newServant.role);

    return jsonResponse(newServant, 201);
  } catch (error: unknown) {
    console.error('Create servant error:', error);
    return serverError('فشل إضافة الخادم');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
