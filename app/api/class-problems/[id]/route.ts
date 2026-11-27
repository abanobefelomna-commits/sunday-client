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
import { getClassProblem, updateClassProblem, PROBLEM_PRIORITIES, PROBLEM_STATUSES } from '@/src/server/class-problems';
import { isUuid, oneOf } from '@/src/server/validation';

async function GETHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف المشكلة غير صالح');

    const access = await getAccessContext(auth);
    const detail = await getClassProblem(access, id);
    if (detail === null) return notFound('المشكلة غير موجودة');
    if (detail === 'forbidden') return forbidden();

    return jsonResponse(detail);
  } catch (error: unknown) {
    console.error('Get class problem error:', error);
    return serverError('فشل جلب المشكلة');
  }
}

async function PATCHHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف المشكلة غير صالح');

    const access = await getAccessContext(auth);
    const body = await req.json();

    if (body?.status !== undefined && !oneOf(body.status, PROBLEM_STATUSES)) {
      return badRequest('حالة المشكلة غير صالحة');
    }
    if (body?.priority !== undefined && !oneOf(body.priority, PROBLEM_PRIORITIES)) {
      return badRequest('الأولوية غير صالحة');
    }

    const result = await updateClassProblem(access, id, {
      status: body?.status === undefined ? undefined : body.status,
      priority: body?.priority === undefined ? undefined : body.priority,
      resolutionNote: body?.resolutionNote === undefined ? undefined : body.resolutionNote,
    });

    if ('error' in result) {
      switch (result.error) {
        case 'not_found':
          return notFound('المشكلة غير موجودة');
        case 'forbidden':
          return forbidden();
        case 'invalid_status':
        case 'invalid_priority':
          return badRequest('بيانات المشكلة غير صالحة');
        default:
          return serverError('فشل تحديث المشكلة');
      }
    }

    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Update class problem error:', error);
    return serverError('فشل تحديث المشكلة');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);