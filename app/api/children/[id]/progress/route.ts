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
  createEducationalProgress,
  listEducationalProgress,
  loadChildScope,
} from '@/src/server/student-notes';
import {
  isIsoDate,
  isUuid,
  optionalText,
  PROGRESS_LEVELS,
  oneOf,
  requiredText,
  todayIso,
} from '@/src/server/validation';

function parseScore(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return 'invalid';
  return Math.round(score * 100) / 100;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }

    return jsonResponse({ data: await listEducationalProgress(id) });
  } catch (error: unknown) {
    console.error('List educational progress error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب التقدم التعليمي');
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }
    if (!scope.canWrite) return forbidden();

    const body = (await req.json()) as Record<string, unknown>;
    const subject = requiredText(body.subject, 'المادة', 120);
    const level = body.level === undefined ? 'growing' : oneOf(body.level, PROGRESS_LEVELS);
    if (!level) return badRequest('المستوى غير صالح');
    const score = parseScore(body.score);
    if (score === 'invalid') return badRequest('الدرجة يجب أن تكون بين 0 و100');
    const assessedAt = body.assessedAt === undefined ? todayIso() : body.assessedAt;
    if (!isIsoDate(assessedAt)) return badRequest('تاريخ التقييم غير صالح');

    const progress = await createEducationalProgress(id, access, {
      subject,
      level,
      score,
      notes: optionalText(body.notes, 2000),
      assessedAt,
    });

    await recordAudit({
      actorId: access.userId,
      action: 'student.progress.create',
      entityType: 'child',
      entityId: id,
      after: { progressId: progress?.id, subject, level, score },
    });

    return jsonResponse(progress, 201);
  } catch (error: unknown) {
    console.error('Create educational progress error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إضافة التقدم التعليمي');
  }
}
