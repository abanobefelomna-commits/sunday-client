import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  jsonResponse,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { listFollowUps, createFollowUp } from '@/src/server/followups';
import {
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
  isUuid,
  oneOf,
  parsePagination,
  requiredText,
} from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    if (classId && !canReadClass(access, classId)) return forbidden();

    const statusParam = searchParams.get('status');
    const status = statusParam === 'active' ? null : oneOf(statusParam, FOLLOW_UP_STATUSES);
    if (statusParam && statusParam !== 'active' && !status) return badRequest('حالة المتابعة غير صالحة');

    const priority = oneOf(searchParams.get('priority'), FOLLOW_UP_PRIORITIES);
    const servantId = isUuid(searchParams.get('servantId')) ? searchParams.get('servantId') : null;
    const search = searchParams.get('search')?.trim() || null;
    const overdue = searchParams.get('overdue') === 'true';
    const { page, limit } = parsePagination(searchParams, { limit: 20, maxLimit: 100 });

    const result = await listFollowUps(
      access,
      {
        status: statusParam === 'active' ? null : status,
        classId,
        servantId,
        priority,
        search,
        overdue,
        activeOnly: statusParam === 'active',
      },
      page,
      limit,
    );

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('List follow-ups error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب المتابعات');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const body = await req.json();
    if (!isUuid(body?.childId)) return badRequest('معرّف الطفل غير صالح');
    if (body?.servantId !== undefined && body?.servantId !== null && !isUuid(body.servantId)) {
      return badRequest('معرّف الخادم غير صالح');
    }
    const priority = body?.priority === undefined ? 'medium' : oneOf(body.priority, FOLLOW_UP_PRIORITIES);
    if (!priority) return badRequest('الأولوية غير صالحة');
    const reason = requiredText(body?.reason, 'سبب المتابعة', 1000);

    const result = await createFollowUp(access, {
      childId: body.childId,
      servantId: body.servantId ?? null,
      priority,
      reason,
      dueDate: body?.dueDate ?? null,
    });

    if ('error' in result) {
      if (result.error === 'forbidden') return forbidden();
      if (result.error === 'child_not_found') return badRequest('الطفل غير موجود');
      if (result.error === 'invalid_servant') return badRequest('الخادم المسؤول غير معيّن على فصل الطفل');
      return serverError('فشل إنشاء المتابعة');
    }
    return jsonResponse(result, 201);
  } catch (error: unknown) {
    console.error('Create follow-up error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إنشاء المتابعة');
  }
}
