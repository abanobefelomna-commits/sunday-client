import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { authorizeClass, getAuthUser, jsonResponse, notFound, badRequest, forbidden, serverError, unauthorized } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';
import { requireTenantContext } from '@/src/server/tenant/context';
import { recordAudit, requestIp } from '@/src/server/audit';

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const { id } = await params;
    if (!(await authorizeClass(user, id))) return forbidden('You can only update the cover image of your assigned class');
    const tenantId = requireTenantContext().churchId;
    const cls = await queryOne<{ id: string; image: string | null }>(
      `SELECT "id", "image" FROM "classes"
       WHERE "id" = $1 AND "churchId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (!cls) {
      return notFound('الفصل غير موجود');
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return badRequest('ملف الصورة مطلوب');
    }

    const { url } = await processUploadedImage(file, 'classes');

    await query(
      `UPDATE "classes" SET "image" = $1, "updatedAt" = now() WHERE "id" = $2 AND "churchId" = $3`,
      [url, id, tenantId],
    );
    await recordAudit({
      actorId: user.sub,
      action: 'class.image.update',
      entityType: 'class',
      entityId: id,
      before: { image: cls.image },
      after: { image: url },
      ip: requestIp(req),
    });

    return jsonResponse({
      message: 'تم رفع الصورة بنجاح',
      image: url,
    });
  } catch (error: unknown) {
    console.error('Upload class image error:', error);
    return badRequest(error instanceof Error ? error.message : 'فشل رفع صورة الفصل');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const { id } = await params;
    if (!(await authorizeClass(user, id))) return forbidden('You can only update the cover image of your assigned class');
    const tenantId = requireTenantContext().churchId;
    const cls = await queryOne<{ id: string; image: string | null }>(
      `SELECT "id", "image" FROM "classes"
       WHERE "id" = $1 AND "churchId" = $2 AND "deletedAt" IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (!cls) {
      return notFound('الفصل غير موجود');
    }

    await query(
      `UPDATE "classes" SET "image" = NULL, "updatedAt" = now() WHERE "id" = $1 AND "churchId" = $2`,
      [id, tenantId],
    );
    await recordAudit({
      actorId: user.sub,
      action: 'class.image.delete',
      entityType: 'class',
      entityId: id,
      before: { image: cls.image },
      after: { image: null },
      ip: requestIp(req),
    });

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: unknown) {
    console.error('Delete class image error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل حذف صورة الفصل');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
