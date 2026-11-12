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
import { recordAudit } from '@/src/server/audit';
import {
  deleteEducationalProgress,
  loadChildScope,
  updateEducationalProgress,
} from '@/src/server/student-notes';
import {
  isIsoDate,
  isUuid,
  optionalText,
  PROGRESS_LEVELS,
  oneOf,
  requiredText,
} from '@/src/server/validation';

function parseScore(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return 'invalid';
  return Math.round(score * 100) / 100;
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string; progressId: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id, progressId } = await params;
    if (!isUuid(id) || !isUuid(progressId)) return badRequest('معرّف غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }
    if (!scope.canWrite) return forbidden();

    const body = (await req.json()) as Record<string, unknown>;
    const level = body.level === undefined ? undefined : oneOf(body.level, PROGRESS_LEVELS);
    if (body.level !== undefined && !level) return badRequest('المستوى غير صالح');
    const score = body.score === undefined ? undefined : parseScore(body.score);
    if (score === 'invalid') return badRequest('الدرجة يجب أن تكون بين 0 و100');
    if (body.assessedAt !== undefined && !isIsoDate(body.assessedAt)) {
      return badRequest('تاريخ التقييم غير صالح');
    }

    const result = await updateEducationalProgress(id, progressId, access, {
      subject:
        body.subject === undefined ? undefined : requiredText(body.subject, 'المادة', 120),
      level: level ?? undefined,
      score,
      notes: body.notes === undefined ? undefined : optionalText(body.notes, 2000),
      assessedAt: body.assessedAt === undefined ? undefined : (body.assessedAt as string),
    });
    if ('error' in result) return notFound('سجل التقدم غير موجود');

    await recordAudit({
      actorId: access.userId,
      action: 'student.progress.update',
      entityType: 'child',
      entityId: id,
      after: { progressId },
    });

    return jsonResponse(result.progress);
  } catch (error: unknown) {
    console.error('Update educational progress error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تعديل التقدم التعليمي');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string; progressId: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id, progressId } = await params;
    if (!isUuid(id) || !isUuid(progressId)) return badRequest('معرّف غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }
    if (!scope.canWrite) return forbidden();

    const result = await deleteEducationalProgress(id, progressId);
    if ('error' in result) return notFound('سجل التقدم غير موجود');

    await recordAudit({
      actorId: access.userId,
      action: 'student.progress.delete',
      entityType: 'child',
      entityId: id,
      before: { progressId },
    });

    return jsonResponse({ message: 'تم حذف سجل التقدم' });
  } catch (error: unknown) {
    console.error('Delete educational progress error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف التقدم التعليمي');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
