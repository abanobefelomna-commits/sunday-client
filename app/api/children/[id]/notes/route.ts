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
import { createStudentNote, listStudentNotes, loadChildScope } from '@/src/server/student-notes';
import { isUuid, NOTE_VISIBILITIES, oneOf, requiredText } from '@/src/server/validation';

async function GETHandler(
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

    return jsonResponse({ data: await listStudentNotes(id, access) });
  } catch (error: unknown) {
    console.error('List student notes error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب الملاحظات');
  }
}

async function POSTHandler(
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
    const text = requiredText(body.body, 'نص الملاحظة', 4000);
    const visibility = body.visibility === undefined ? 'class' : oneOf(body.visibility, NOTE_VISIBILITIES);
    if (!visibility) return badRequest('مستوى الظهور غير صالح');

    const result = await createStudentNote(id, access, { body: text, visibility });
    if ('error' in result) return forbidden();

    await recordAudit({
      actorId: access.userId,
      action: 'student.note.create',
      entityType: 'child',
      entityId: id,
      after: { noteId: result.note?.id, visibility },
    });

    return jsonResponse(result.note, 201);
  } catch (error: unknown) {
    console.error('Create student note error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل إضافة الملاحظة');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
