import { withTenant } from '@/src/server/tenant/route';
import { query } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canManageServantRecord,
  jsonResponse,
  notFound,
  badRequest,
  serverError,
  unauthorized,
  forbidden,
} from '@/src/server/middleware';
import { loadServantAccessRecord } from '@/src/server/servants';
import { processUploadedImage, UploadValidationError } from '@/src/server/upload';
import { isUuid } from '@/src/server/validation';

async function loadManagedServant(req: Request, id: string) {
  const auth = await getAuthUser(req);
  if (!auth) return { ok: false as const, response: unauthorized() };
  const access = await getAccessContext(auth);
  const record = await loadServantAccessRecord(id);
  if (!record) return { ok: false as const, response: notFound('الخادم غير موجود') };
  if (!canManageServantRecord(access, record)) {
    return { ok: false as const, response: forbidden('غير مسموح بإدارة صورة هذا الخادم') };
  }
  return { ok: true as const, record };
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الخادم غير صالح');
    const managed = await loadManagedServant(req, id);
    if (!managed.ok) return managed.response;

    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) {
      return badRequest('ملف الصورة مطلوب');
    }

    const { url } = await processUploadedImage(file, 'avatars');

    await query(
      `UPDATE "servants" SET "avatar" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [url, id],
    );

    return jsonResponse({
      message: 'تم رفع الصورة بنجاح',
      avatar: url,
    });
  } catch (error: unknown) {
    if (error instanceof UploadValidationError) {
      return badRequest(error.message);
    }
    console.error('Upload servant avatar error:', error);
    return serverError('فشل رفع صورة الخادم');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الخادم غير صالح');
    const managed = await loadManagedServant(req, id);
    if (!managed.ok) return managed.response;

    await query(
      `UPDATE "servants" SET "avatar" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: unknown) {
    console.error('Delete servant avatar error:', error);
    return serverError('فشل حذف صورة الخادم');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
