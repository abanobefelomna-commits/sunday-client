import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  canWriteClass,
  jsonResponse,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { recordAudit, requestIp } from '@/src/server/audit';
import { ATTENDANCE_STATUSES, isUuid, oneOf, optionalText } from '@/src/server/validation';

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف سجل الحضور غير صالح');

    const row = await queryOne<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
      notes: string | null;
      recordedBy: string | null;
      updatedBy: string | null;
      sessionId: string | null;
      childName: string | null;
      className: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT a."id", a."childId", a."classId", a."date"::text AS "date",
              a."status"::text AS "status", a."notes", a."recordedBy", a."updatedBy",
              a."sessionId", a."createdAt", a."updatedAt",
              c."name" AS "childName", cls."name" AS "className"
       FROM "attendance" a
       LEFT JOIN "children" c ON c."id" = a."childId"
       LEFT JOIN "classes" cls ON cls."id" = a."classId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (!row) return notFound('سجل الحضور غير موجود');

    const access = await getAccessContext(auth);
    if (!canReadClass(access, row.classId)) return forbidden();

    return jsonResponse({
      ...row,
      child: { id: row.childId, name: row.childName },
      class: { id: row.classId, name: row.className },
    });
  } catch (error: unknown) {
    console.error('Get attendance record error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب سجل الحضور');
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
    if (!isUuid(id)) return badRequest('معرّف سجل الحضور غير صالح');

    const existing = await queryOne<{
      id: string;
      classId: string;
      status: string;
      notes: string | null;
      updatedAt: Date;
    }>(`SELECT "id", "classId", "status"::text AS "status", "notes", "updatedAt" FROM "attendance" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!existing) return notFound('سجل الحضور غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, existing.classId)) return forbidden();

    const body = await req.json();
    const status = body?.status === undefined ? null : oneOf(body.status, ATTENDANCE_STATUSES);
    if (body?.status !== undefined && !status) return badRequest('حالة حضور غير صالحة');
    if (status === null && body?.notes === undefined) return badRequest('لا توجد حقول للتعديل');

    const updated = await queryOne(
      `UPDATE "attendance"
       SET "status" = COALESCE($1::attendance_status_enum, "status"),
           "notes" = CASE WHEN $2::boolean THEN $3 ELSE "notes" END,
           "updatedBy" = $4,
           "updatedAt" = now()
       WHERE "id" = $5
       RETURNING *`,
      [status, body?.notes !== undefined, optionalText(body?.notes, 300), auth.sub, id],
    );

    await recordAudit({
      actorId: access.userId,
      action: 'attendance.update',
      entityType: 'attendance',
      entityId: id,
      before: existing,
      after: updated,
      ip: requestIp(req),
    });

    return jsonResponse(updated);
  } catch (error: unknown) {
    console.error('Update attendance record error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تعديل سجل الحضور');
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
    if (!isUuid(id)) return badRequest('معرّف سجل الحضور غير صالح');

    const existing = await queryOne<{ id: string; classId: string; childId: string; date: string }>(
      `SELECT "id", "classId", "childId", "date"::text AS "date" FROM "attendance" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!existing) return notFound('سجل الحضور غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, existing.classId)) return forbidden();

    await query(`DELETE FROM "attendance" WHERE "id" = $1`, [id]);
    await recordAudit({
      actorId: access.userId,
      action: 'attendance.delete',
      entityType: 'attendance',
      entityId: id,
      before: existing,
      ip: requestIp(req),
    });

    return jsonResponse({ message: 'تم حذف سجل الحضور' });
  } catch (error: unknown) {
    console.error('Delete attendance record error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف سجل الحضور');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
