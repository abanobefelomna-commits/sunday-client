import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne, transaction } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canAssignServantRole,
  canManageServantRecord,
  effectiveClassIds,
  hasBroadClassRead,
  isClassLeaderAccess,
  jsonResponse,
  notFound,
  forbidden,
  badRequest,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import {
  claimClassLeadership,
  loadServantAccessRecord,
  isPrivilegedServantRole,
  normalizeServantRole,
  reconcileServantLeadership,
  servantRoleLabel,
} from '@/src/server/servants';
import { revokeAllUserRefreshTokens } from '@/src/server/auth';
import { recordAudit, requestIp } from '@/src/server/audit';
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

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الخادم غير صالح');

    const record = await loadServantAccessRecord(id);
    if (!record) {
      return notFound('الخادم غير موجود');
    }

    const self = record.userId !== null && record.userId === access.userId;
    const readable =
      self ||
      hasBroadClassRead(access) ||
      record.classIds.some((classId) => effectiveClassIds(access).includes(classId));
    if (!readable) return forbidden('غير مسموح بعرض بيانات هذا الخادم');

    const classes = await query<{
      id: string;
      name: string;
      grade: string;
    }>(
      `SELECT c."id", c."name", c."grade"
       FROM "classes" c
       JOIN "servants_classes" sc ON sc."classesId" = c."id"
       WHERE sc."servantsId" = $1`,
      [id],
    );

    const servant = await queryOne<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      role: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(`SELECT * FROM "servants" WHERE "id" = $1 LIMIT 1`, [id]);

    return jsonResponse({
      ...servant,
      classes,
    });
  } catch (error: unknown) {
    console.error('Get servant error:', error);
    return serverError('فشل جلب تفاصيل الخادم');
  }
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الخادم غير صالح');

    const record = await loadServantAccessRecord(id);
    if (!record) return notFound('الخادم غير موجود');
    if (!canManageServantRecord(access, record)) {
      return forbidden('غير مسموح بتعديل بيانات هذا الخادم');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('بيانات غير صالحة');
    const { name, phone, email, role, classIds } = body as Record<string, unknown>;

    let canonicalRole: string | null = null;
    if (role !== undefined && role !== null) {
      const code = normalizeServantRole(role);
      if (!code) {
        return badRequest('صفة الخدمة غير صالحة');
      }
      if (!canAssignServantRole(access, code)) {
        return forbidden('غير مسموح بتعيين هذه الصفة');
      }
      canonicalRole = servantRoleLabel(code);
    }

    // Only administrators/priests (or roles.manage) may touch or create a
    // privileged servant, so servants.write alone cannot escalate privileges.
    if (
      (isPrivilegedServantRole(record.role) || isPrivilegedServantRole(canonicalRole)) &&
      !canManagePrivilegedServants(access)
    ) {
      return forbidden('تعديل بيانات المسؤول أو الأب الكاهن متاح للمسؤول والكاهن فقط');
    }

    const finalRole = canonicalRole ?? record.role;
    const finalRoleCode = normalizeServantRole(finalRole);
    const privilegedFinalRole = finalRoleCode === 'admin' || finalRoleCode === 'priest';
    const leaderFinalRole = finalRoleCode === 'class_leader';

    let requestedClassIds: string[] | null = null;
    if (Array.isArray(classIds)) {
      requestedClassIds = validUuidList(classIds);
      if (isClassLeaderAccess(access)) {
        const led = access.ledClassIds ?? [];
        if (
          requestedClassIds.length !== 1 ||
          !led.includes(requestedClassIds[0])
        ) {
          return forbidden('غير مسموح بنقل الخادم خارج فصلك');
        }
      }
    }

    if (privilegedFinalRole) {
      requestedClassIds = [];
    } else if (leaderFinalRole) {
      const resolved = requestedClassIds ?? record.classIds;
      if (resolved.length !== 1) {
        return badRequest('قائد الفصل يجب أن يكون مسؤولًا عن فصل واحد فقط');
      }
      requestedClassIds = resolved;

      const target = await queryOne<{ id: string; leadServantId: string | null }>(
        `SELECT "id", "leadServantId" FROM "classes" WHERE "id" = $1 LIMIT 1`,
        [resolved[0]],
      );
      if (!target) return badRequest('الفصل المختار غير صالح');
      if (target.leadServantId && target.leadServantId !== id) {
        return forbidden('هذا الفصل لديه قائد بالفعل');
      }
    }

    if (requestedClassIds !== null && requestedClassIds.length > 0) {
      const found = await query<{ id: string }>(
        `SELECT "id" FROM "classes" WHERE "id" = ANY($1::uuid[])`,
        [requestedClassIds],
      );
      if (found.length !== requestedClassIds.length) {
        return badRequest('أحد الفصول المختارة غير صالح');
      }
    }

    const updated = await queryOne(
      `UPDATE "servants"
       SET "name" = COALESCE($1, "name"),
           "phone" = COALESCE($2, "phone"),
           "email" = CASE WHEN $3::boolean THEN $4 ELSE "email" END,
           "role" = COALESCE($5, "role"),
           "updatedAt" = now()
       WHERE "id" = $6
       RETURNING *`,
      [
        typeof name === 'string' && name.trim() ? name.trim() : null,
        typeof phone === 'string' && phone.trim() ? phone.trim() : null,
        email !== undefined,
        typeof email === 'string' && email.trim() ? email.trim() : null,
        canonicalRole,
        id,
      ],
    );

    if (!updated) {
      return notFound('الخادم غير موجود');
    }

    if (requestedClassIds !== null) {
      await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [id]);
      for (const cId of requestedClassIds) {
        await query(
          `INSERT INTO "servants_classes" ("servantsId", "classesId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, cId],
        );
      }
    }

    await reconcileServantLeadership(id, finalRole);

    if (leaderFinalRole) {
      const classId = (requestedClassIds ?? record.classIds)[0];
      if (classId) {
        const cls = await queryOne<{ leadServantId: string | null }>(
          `SELECT "leadServantId" FROM "classes" WHERE "id" = $1 LIMIT 1`,
          [classId],
        );
        if (!cls) return badRequest('الفصل المختار غير صالح');
        if (cls.leadServantId && cls.leadServantId !== id) {
          return forbidden('هذا الفصل لديه قائد بالفعل');
        }
        // Moving a leader to another class must release the previous class.
        await query(
          `UPDATE "classes" SET "leadServantId" = NULL, "updatedAt" = now()
           WHERE "leadServantId" = $1 AND "id" <> $2`,
          [id, classId],
        );
        if (!cls.leadServantId) {
          await claimClassLeadership(id, classId);
        }
      }
    }

    return jsonResponse(updated);
  } catch (error: unknown) {
    console.error('Update servant error:', error);
    return serverError('فشل تعديل بيانات الخادم');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الخادم غير صالح');

    const record = await loadServantAccessRecord(id);
    if (!record) return notFound('الخادم غير موجود');
    if (!canManageServantRecord(access, record)) {
      return forbidden('غير مسموح بحذف هذا الخادم');
    }
    if (isPrivilegedServantRole(record.role) && !canManagePrivilegedServants(access)) {
      return forbidden('حذف المسؤول أو الأب الكاهن متاح للمسؤول والكاهن فقط');
    }

    // A linked privileged account can never be removed through the servant
    // directory, even if the servant row label drifted from the account role.
    let linkedUserRole: string | null = null;
    if (record.userId) {
      const linked = await queryOne<{ role: string }>(
        `SELECT "role" FROM "users" WHERE "id" = $1 LIMIT 1`,
        [record.userId],
      );
      linkedUserRole = linked?.role ?? null;
      if (linkedUserRole && ['admin', 'priest'].includes(linkedUserRole) && !access.privileged) {
        return forbidden('غير مسموح بحذف حساب مسؤول أو كاهن');
      }
    }

    const statements = [
      {
        text: `UPDATE "classes" SET "leadServantId" = NULL, "updatedAt" = now()
               WHERE "leadServantId" = $1`,
        params: [id],
      },
      {
        text: `UPDATE "children" SET "assignedServantId" = NULL, "updatedAt" = now()
               WHERE "assignedServantId" = $1`,
        params: [id],
      },
      {
        text: `UPDATE "visitations" SET "servantId" = NULL WHERE "servantId" = $1`,
        params: [id],
      },
      {
        text: `UPDATE "follow_ups" SET "servantId" = NULL, "updatedAt" = now()
               WHERE "servantId" = $1`,
        params: [id],
      },
      {
        text: `DELETE FROM "servants_classes" WHERE "servantsId" = $1`,
        params: [id],
      },
      {
        text: `DELETE FROM "servants" WHERE "id" = $1`,
        params: [id],
      },
    ];

    // A regular account has no reason to survive its servant profile: deleting
    // the row also removes personal data, sessions and role bindings. Accounts
    // with a privileged role are kept so the church cannot lose its admins.
    const deleteLinkedUser =
      record.userId !== null && !['admin', 'priest'].includes(linkedUserRole ?? '');
    if (deleteLinkedUser) {
      statements.push({
        text: `DELETE FROM "users" WHERE "id" = $1`,
        params: [record.userId as string],
      });
    }

    await transaction(statements);

    if (record.userId && !deleteLinkedUser) {
      await revokeAllUserRefreshTokens(record.userId);
    }

    await recordAudit({
      actorId: access.userId,
      action: 'servant.delete',
      entityType: 'servant',
      entityId: id,
      before: { role: record.role, classIds: record.classIds },
      ip: requestIp(req),
    });

    return jsonResponse({ message: 'تم حذف الخادم وكل بياناته نهائيًا' });
  } catch (error: unknown) {
    console.error('Delete servant error:', error);
    return serverError('فشل حذف الخادم');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
