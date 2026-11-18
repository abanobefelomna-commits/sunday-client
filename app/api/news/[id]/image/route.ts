import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  notFound,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { processUploadedImage, UploadValidationError } from '@/src/server/upload';

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await queryOne<{ id: string; authorId: string | null }>(
      `SELECT "id", "authorId" FROM "news" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!existing) {
      return notFound('الخبر غير موجود');
    }

    const access = await getAccessContext(auth);
    const canEdit =
      access.privileged ||
      access.permissions.includes('news.write') ||
      existing.authorId === auth.sub;
    if (!canEdit) return forbidden('غير مسموح بتعديل هذا الخبر');

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return badRequest('ملف الصورة مطلوب');
    }

    const { url } = await processUploadedImage(file, 'news');

    await query(
      `UPDATE "news" SET "image" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [url, id],
    );

    return jsonResponse({
      message: 'تم رفع صورة الخبر بنجاح',
      image: url,
    });
  } catch (error: unknown) {
    if (error instanceof UploadValidationError) {
      return badRequest(error.message);
    }
    console.error('Upload news image error:', error);
    return serverError('فشل رفع صورة الخبر');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await queryOne<{ id: string; authorId: string | null }>(
      `SELECT "id", "authorId" FROM "news" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!existing) {
      return notFound('الخبر غير موجود');
    }

    const access = await getAccessContext(auth);
    const canDelete =
      access.privileged ||
      access.permissions.includes('news.write') ||
      existing.authorId === auth.sub;
    if (!canDelete) return forbidden('غير مسموح بحذف هذا الخبر');

    await query(
      `UPDATE "news" SET "image" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    return jsonResponse({ message: 'تم حذف صورة الخبر بنجاح' });
  } catch (error: unknown) {
    console.error('Delete news image error:', error);
    return serverError('فشل حذف صورة الخبر');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
