import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  canWriteClass,
  jsonResponse,
  notFound,
  forbidden,
  badRequest,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { recordAudit, requestIp } from '@/src/server/audit';
import { isUuid, isIsoDate, oneOf, optionalText } from '@/src/server/validation';

const GENDERS = ['male', 'female'] as const;

async function loadChild(id: string) {
  return queryOne<{
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
    assignedServantId: string | null;
    deletedAt: Date | null;
    className: string | null;
    classGrade: string | null;
    assignedServantName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT c.*, cls."name" AS "className", cls."grade" AS "classGrade",
            asg."name" AS "assignedServantName"
     FROM "children" c
     LEFT JOIN "classes" cls ON cls."id" = c."classId"
     LEFT JOIN "servants" asg ON asg."id" = c."assignedServantId"
     WHERE c."id" = $1 AND c."deletedAt" IS NULL
     LIMIT 1`,
    [id],
  );
}

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const row = await loadChild(id);
    if (!row) return notFound('الطفل غير موجود');

    const access = await getAccessContext(auth);
    if (!canReadClass(access, row.classId)) return forbidden();

    return jsonResponse({
      id: row.id,
      name: row.name,
      birthDate: row.birthDate,
      gender: row.gender,
      parentPhone: row.parentPhone,
      parentName: row.parentName,
      address: row.address,
      notes: row.notes,
      phone: row.phone,
      avatar: row.avatar,
      classId: row.classId,
      assignedServantId: row.assignedServantId,
      assignedServant: row.assignedServantId
        ? { id: row.assignedServantId, name: row.assignedServantName }
        : null,
      class: row.classId
        ? { id: row.classId, name: row.className, grade: row.classGrade }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (error: unknown) {
    console.error('Get child error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب تفاصيل الطفل');
  }
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const existing = await loadChild(id);
    if (!existing) return notFound('الطفل غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, existing.classId)) return forbidden();

    const body = (await req.json()) as Record<string, unknown>;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

    let targetClassId = existing.classId;
    if (has('classId')) {
      if (body.classId !== null && body.classId !== '' && !isUuid(body.classId)) {
        return badRequest('معرّف الفصل غير صالح');
      }
      targetClassId = body.classId === null || body.classId === '' ? null : (body.classId as string);
      if (!access.privileged && !canWriteClass(access, targetClassId)) return forbidden();
    }

    if (has('birthDate') && body.birthDate !== null && body.birthDate !== '' && !isIsoDate(body.birthDate)) {
      return badRequest('تاريخ الميلاد غير صالح');
    }
    if (has('gender') && !oneOf(body.gender, GENDERS)) {
      return badRequest('النوع غير صالح');
    }
    if (has('assignedServantId') && body.assignedServantId !== null && body.assignedServantId !== '' && !isUuid(body.assignedServantId)) {
      return badRequest('الخادم المسؤول غير صالح');
    }

    // If the class changes, keep the assigned servant only when still assigned
    // to the destination class.
    let assignedServantId = has('assignedServantId')
      ? (body.assignedServantId === null || body.assignedServantId === '' ? null : (body.assignedServantId as string))
      : existing.assignedServantId;
    if (assignedServantId) {
      const servant = await queryOne<{ id: string }>(
        `SELECT s."id" FROM "servants" s
         WHERE s."id" = $1
           AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM "servants_classes" sc
             WHERE sc."servantsId" = s."id" AND sc."classesId" = $2
           ))
         LIMIT 1`,
        [assignedServantId, targetClassId],
      );
      if (!servant) {
        if (has('assignedServantId')) return badRequest('الخادم المسؤول غير معيّن على هذا الفصل');
        assignedServantId = null;
      }
    }

    const setters: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      setters.push(`"${column}" = $${values.length}`);
    };

    if (has('name')) {
      if (typeof body.name !== 'string' || !body.name.trim()) return badRequest('اسم الطفل مطلوب');
      add('name', body.name.trim().slice(0, 160));
    }
    if (has('birthDate')) add('birthDate', body.birthDate || existing.birthDate);
    if (has('gender')) add('gender', body.gender);
    if (has('parentPhone')) add('parentPhone', optionalText(body.parentPhone, 30));
    if (has('parentName')) add('parentName', optionalText(body.parentName, 160));
    if (has('address')) add('address', optionalText(body.address, 300));
    if (has('notes')) add('notes', optionalText(body.notes, 1000));
    if (has('phone')) add('phone', optionalText(body.phone, 30));
    if (has('avatar')) add('avatar', optionalText(body.avatar, 500) ?? null);
    if (has('classId')) add('classId', targetClassId);
    if (has('assignedServantId') || assignedServantId !== existing.assignedServantId) {
      add('assignedServantId', assignedServantId);
    }

    if (setters.length === 0) return badRequest('لا توجد حقول للتعديل');

    values.push(id);
    const updated = await queryOne(
      `UPDATE "children"
       SET ${setters.join(', ')}, "updatedAt" = now()
       WHERE "id" = $${values.length} AND "deletedAt" IS NULL
       RETURNING *`,
      values,
    );

    await recordAudit({
      actorId: access.userId,
      action: 'student.update',
      entityType: 'child',
      entityId: id,
      before: {
        name: existing.name,
        classId: existing.classId,
        assignedServantId: existing.assignedServantId,
        parentPhone: existing.parentPhone,
        notes: existing.notes,
      },
      after: updated,
      ip: requestIp(req),
    });

    return jsonResponse(updated);
  } catch (error: unknown) {
    console.error('Update child error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تعديل بيانات الطفل');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const child = await loadChild(id);
    if (!child) return notFound('الطفل غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, child.classId)) return forbidden();

    // Soft removal: attendance, visitations, progress and care history stay
    // available for authorized historical reporting.
    await query(
      `UPDATE "children" SET "deletedAt" = now(), "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    await recordAudit({
      actorId: access.userId,
      action: 'student.soft_delete',
      entityType: 'child',
      entityId: id,
      before: { name: child.name, classId: child.classId },
      after: { deletedAt: new Date().toISOString() },
      ip: requestIp(req),
    });

    return jsonResponse({ message: 'تم حذف الطفل بنجاح مع الاحتفاظ بسجله التاريخي' });
  } catch (error: unknown) {
    console.error('Delete child error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف الطفل');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
