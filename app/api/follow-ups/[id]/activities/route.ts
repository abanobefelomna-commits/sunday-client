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
import { addFollowUpActivity } from '@/src/server/followups';
import { ACTIVITY_TYPES, isUuid, oneOf, requiredText } from '@/src/server/validation';

export async function POST(
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
    const type = oneOf(body?.type, ACTIVITY_TYPES.filter((value) => value !== 'status_change' && value !== 'resolution' && value !== 'assignment'));
    if (!type) return badRequest('نوع النشاط غير صالح');
    const title = requiredText(body?.title, 'عنوان النشاط', 180);

    const result = await addFollowUpActivity(access, id, {
      type,
      title,
      notes: body?.notes ?? null,
    });
    if ('error' in result) {
      if (result.error === 'forbidden') return forbidden();
      if (result.error === 'not_found') return notFound('المتابعة غير موجودة');
      return badRequest('بيانات النشاط غير صالحة');
    }

    return jsonResponse(result, 201);
  } catch (error: unknown) {
    console.error('Add follow-up activity error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إضافة النشاط');
  }
}
