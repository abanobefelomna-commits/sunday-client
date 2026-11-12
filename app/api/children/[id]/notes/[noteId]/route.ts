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
  deleteStudentNote,
  loadChildScope,
  updateStudentNote,
} from '@/src/server/student-notes';
import { isUuid, NOTE_VISIBILITIES, oneOf, requiredText } from '@/src/server/validation';

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id, noteId } = await params;
    if (!isUuid(id) || !isUuid(noteId)) return badRequest('معرّف غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }
    if (!scope.canWrite) return forbidden();

    const body = (await req.json()) as Record<string, unknown>;
    const visibility = body.visibility === undefined ? undefined : oneOf(body.visibility, NOTE_VISIBILITIES);
    if (body.visibility !== undefined && !visibility) return badRequest('مستوى الظهور غير صالح');

    const result = await updateStudentNote(id, noteId, access, {
      body: body.body === undefined ? undefined : requiredText(body.body, 'نص الملاحظة', 4000),
      visibility: visibility ?? undefined,
    });
    if ('error' in result) {
      return result.error === 'forbidden' ? forbidden() : notFound('الملاحظة غير موجودة');
    }

    await recordAudit({
      actorId: access.userId,
      action: 'student.note.update',
      entityType: 'child',
      entityId: id,
      after: { noteId },
    });

    return jsonResponse(result.note);
  } catch (error: unknown) {
    console.error('Update student note error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تعديل الملاحظة');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id, noteId } = await params;
    if (!isUuid(id) || !isUuid(noteId)) return badRequest('معرّف غير صالح');

    const access = await getAccessContext(auth);
    const scope = await loadChildScope(id, access);
    if ('error' in scope) {
      return scope.error === 'forbidden' ? forbidden() : notFound('الطفل غير موجود');
    }
    if (!scope.canWrite) return forbidden();

    const result = await deleteStudentNote(id, noteId, access);
    if ('error' in result) {
      return result.error === 'forbidden' ? forbidden() : notFound('الملاحظة غير موجودة');
    }

    await recordAudit({
      actorId: access.userId,
      action: 'student.note.delete',
      entityType: 'child',
      entityId: id,
      before: { noteId },
    });

    return jsonResponse({ message: 'تم حذف الملاحظة' });
  } catch (error: unknown) {
    console.error('Delete student note error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف الملاحظة');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
