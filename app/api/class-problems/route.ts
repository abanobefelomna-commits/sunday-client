import { withTenant } from '@/src/server/tenant/route';
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
import { listClassProblems, createClassProblem, PROBLEM_CATEGORIES, PROBLEM_PRIORITIES, PROBLEM_STATUSES } from '@/src/server/class-problems';
import { isUuid, oneOf, parsePagination } from '@/src/server/validation';
import { getRequestIp, rateLimit, rateLimitedResponse } from '@/src/server/security';

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    if (classId && !canReadClass(access, classId)) return forbidden();

    const statusParam = searchParams.get('status');
    const status = statusParam === 'active' ? null : oneOf(statusParam, PROBLEM_STATUSES);
    if (statusParam && statusParam !== 'active' && !status) return badRequest('حالة المشكلة غير صالحة');

    const priority = oneOf(searchParams.get('priority'), PROBLEM_PRIORITIES);
    if (searchParams.get('priority') && !priority) return badRequest('الأولوية غير صالحة');

    const search = searchParams.get('search')?.trim() || null;
    const { page, limit } = parsePagination(searchParams, { limit: 20, maxLimit: 100 });

    const result = await listClassProblems(
      access,
      { status: statusParam === 'active' ? null : status, classId, priority, search },
      page,
      limit,
    );

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('List class problems error:', error);
    return serverError('فشل جلب مشاكل الفصول');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const ip = getRequestIp(req);
    const limit = rateLimit(`class-problem:${ip}`, 20, 60 * 60);
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

    const body = await req.json();
    if (!isUuid(body?.classId)) return badRequest('الفصل غير صالح');
    const category = body?.category === undefined ? null : oneOf(body.category, PROBLEM_CATEGORIES);
    if (!category) return badRequest('نوع المشكلة غير صالح');
    const priority = body?.priority === undefined ? 'medium' : oneOf(body.priority, PROBLEM_PRIORITIES);
    if (!priority) return badRequest('الأولوية غير صالحة');

    const result = await createClassProblem(access, {
      classId: body.classId,
      category,
      title: String(body?.title ?? ''),
      description: String(body?.description ?? ''),
      priority,
    });

    if ('error' in result) {
      switch (result.error) {
        case 'forbidden':
          return forbidden();
        case 'class_not_found':
          return badRequest('الفصل غير موجود أو غير مفعّل');
        case 'title_required':
          return badRequest('اكتب عنوان المشكلة');
        case 'description_required':
          return badRequest('اكتب وصف المشكلة');
        default:
          return serverError('فشل إنشاء المشكلة');
      }
    }
    return jsonResponse(result, 201);
  } catch (error: unknown) {
    console.error('Create class problem error:', error);
    return serverError('فشل إنشاء المشكلة');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);