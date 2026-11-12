import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { getFollowUpDetail, updateFollowUp } from '@/src/server/followups';
import { FOLLOW_UP_PRIORITIES, FOLLOW_UP_STATUSES, isUuid, oneOf } from '@/src/server/validation';

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف المتابعة غير صالح');

    const access = await getAccessContext(auth);
    const detail = await getFollowUpDetail(id, access);
    if (detail === null) return notFound('المتابعة غير موجودة');
    if (detail === 'forbidden') return forbidden();

    return jsonResponse(detail);
  } catch (error: unknown) {
    console.error('Get follow-up error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب المتابعة');
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
    if (!isUuid(id)) return badRequest('معرّف المتابعة غير صالح');

    const access = await getAccessContext(auth);
    const body = await req.json();

    if (body?.status !== undefined && !oneOf(body.status, FOLLOW_UP_STATUSES)) {
      return badRequest('حالة المتابعة غير صالحة');
    }
    if (body?.priority !== undefined && !oneOf(body.priority, FOLLOW_UP_PRIORITIES)) {
      return badRequest('الأولوية غير صالحة');
    }

    const result = await updateFollowUp(access, id, {
      status: body?.status ?? undefined,
      priority: body?.priority ?? undefined,
      servantId: body?.servantId === undefined ? undefined : body.servantId,
      dueDate: body?.dueDate === undefined ? undefined : body.dueDate,
      resolutionNotes: body?.resolutionNotes === undefined ? undefined : body.resolutionNotes,
    });

    if ('error' in result) {
      switch (result.error) {
        case 'not_found':
          return notFound('المتابعة غير موجودة');
        case 'forbidden':
          return forbidden();
        case 'invalid_status':
        case 'invalid_priority':
        case 'invalid_due_date':
        case 'invalid_servant':
          return badRequest('بيانات المتابعة غير صالحة');
        case 'resolution_required':
          return badRequest('اكتب ملاحظات الإغلاق قبل حل المتابعة');
        default:
          return serverError('فشل تحديث المتابعة');
      }
    }

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Update follow-up error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تحديث المتابعة');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
