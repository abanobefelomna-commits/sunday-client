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
import { updateFollowUpRule } from '@/src/server/followups';
import { FOLLOW_UP_PRIORITIES, isUuid, oneOf } from '@/src/server/validation';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!access.privileged) return forbidden('تعديل القواعد متاح للمسؤول والكاهن فقط');

    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف القاعدة غير صالح');
    const body = await req.json();
    if (body?.priority !== undefined && !oneOf(body.priority, FOLLOW_UP_PRIORITIES)) {
      return badRequest('الأولوية غير صالحة');
    }

    const result = await updateFollowUpRule(access, id, {
      threshold: body?.threshold === undefined ? undefined : body.threshold,
      windowDays: body?.windowDays === undefined ? undefined : body.windowDays,
      isActive: body?.isActive === undefined ? undefined : body.isActive,
      priority: body?.priority ?? undefined,
    });

    if ('error' in result) {
      if (result.error === 'forbidden') return forbidden();
      if (result.error === 'not_found') return notFound('القاعدة غير موجودة');
      return badRequest('بيانات القاعدة غير صالحة');
    }

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Update follow-up rule error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تحديث القاعدة');
  }
}
