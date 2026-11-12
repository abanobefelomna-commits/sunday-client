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
import { isIsoDate, isUuid, oneOf } from '@/src/server/validation';

const VISIT_TYPES = ['home_visit', 'phone_call', 'church_meeting', 'other'] as const;
const VISIT_STATUSES = ['planned', 'completed', 'cancelled'] as const;

async function loadVisitation(id: string) {
  return queryOne<{
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
    childClassId: string | null;
    servantName: string | null;
  }>(
    `SELECT v.*, v."date"::text AS "date", v."followUpDate"::text AS "followUpDate",
            v."type"::text AS "type", v."status"::text AS "status",
            c."name" AS "childName", c."classId" AS "childClassId", s."name" AS "servantName"
     FROM "visitations" v
     LEFT JOIN "children" c ON c."id" = v."childId"
     LEFT JOIN "servants" s ON s."id" = v."servantId"
     WHERE v."id" = $1 LIMIT 1`,
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
    if (!isUuid(id)) return badRequest('معرّف سجل الافتقاد غير صالح');

    const row = await loadVisitation(id);
    if (!row) return notFound('سجل الافتقاد غير موجود');

    const access = await getAccessContext(auth);
    if (!canReadClass(access, row.childClassId)) return forbidden();

    return jsonResponse({
      ...row,
      child: { id: row.childId, name: row.childName },
      servant: row.servantId ? { id: row.servantId, name: row.servantName } : null,
    });
  } catch (error: unknown) {
    console.error('Get visitation error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب تفاصيل الافتقاد');
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
    if (!isUuid(id)) return badRequest('معرّف سجل الافتقاد غير صالح');

    const existing = await loadVisitation(id);
    if (!existing) return notFound('سجل الافتقاد غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, existing.childClassId)) return forbidden();

    const body = await req.json();
    if (body?.date !== undefined && !isIsoDate(body.date)) return badRequest('التاريخ غير صالح');
    if (body?.type !== undefined && !oneOf(body.type, VISIT_TYPES)) return badRequest('نوع الافتقاد غير صالح');
    if (body?.status !== undefined && !oneOf(body.status, VISIT_STATUSES)) return badRequest('حالة الافتقاد غير صالحة');
    if (body?.servantId !== undefined && body.servantId !== null && !isUuid(body.servantId)) {
      return badRequest('معرّف الخادم غير صالح');
    }
    if (body?.followUpDate !== undefined && body.followUpDate !== null && !isIsoDate(body.followUpDate)) {
      return badRequest('تاريخ المتابعة غير صالح');
    }

    const updated = await queryOne(
      `UPDATE "visitations"
       SET "servantId" = CASE WHEN $1::boolean THEN $2::uuid ELSE "servantId" END,
           "date" = COALESCE($3::date, "date"),
           "type" = COALESCE($4::text::visitations_type_enum, "type"),
           "status" = COALESCE($5::text::visitations_status_enum, "status"),
           "notes" = CASE WHEN $6::boolean THEN $7 ELSE "notes" END,
           "followUpDate" = CASE WHEN $8::boolean THEN $9::date ELSE "followUpDate" END,
           "updatedAt" = now()
       WHERE "id" = $10
       RETURNING *`,
      [
        body?.servantId !== undefined,
        body?.servantId || null,
        body?.date || null,
        body?.type || null,
        body?.status || null,
        body?.notes !== undefined,
        body?.notes || null,
        body?.followUpDate !== undefined,
        body?.followUpDate || null,
        id,
      ],
    );

    await recordAudit({
      actorId: access.userId,
      action: 'visitation.update',
      entityType: 'visitation',
      entityId: id,
      before: { status: existing.status, date: existing.date, servantId: existing.servantId },
      after: updated,
      ip: requestIp(req),
    });

    return jsonResponse(updated);
  } catch (error: unknown) {
    console.error('Update visitation error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تعديل سجل الافتقاد');
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
    if (!isUuid(id)) return badRequest('معرّف سجل الافتقاد غير صالح');

    const existing = await loadVisitation(id);
    if (!existing) return notFound('سجل الافتقاد غير موجود');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, existing.childClassId)) return forbidden();

    await query(`DELETE FROM "visitations" WHERE "id" = $1`, [id]);
    await recordAudit({
      actorId: access.userId,
      action: 'visitation.delete',
      entityType: 'visitation',
      entityId: id,
      before: { childId: existing.childId, date: existing.date, status: existing.status },
      ip: requestIp(req),
    });

    return jsonResponse({ message: 'تم حذف سجل الافتقاد بنجاح' });
  } catch (error: unknown) {
    console.error('Delete visitation error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف سجل الافتقاد');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
