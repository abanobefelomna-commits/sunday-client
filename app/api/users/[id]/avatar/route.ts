import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, notFound, unauthorized, forbidden, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage, UploadValidationError } from '@/src/server/upload';
import { syncServantAvatarForUser } from '@/src/server/servants';

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) {
      return unauthorized();
    }
    if (auth.sub !== id) {
      return forbidden('يمكنك تغيير صورتك الشخصية فقط');
    }

    const user = await queryOne<{ id: string; phone: string }>(
      `SELECT "id", "phone" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!user) {
      return notFound('المستخدم غير موجود');
    }

    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return badRequest('ملف الصورة مطلوب');
    }

    const { url } = await processUploadedImage(file, 'avatars');

    await query(
      `UPDATE "users" SET "avatar" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [url, id],
    );

    await syncServantAvatarForUser(user.id, url);

    return jsonResponse({
      message: 'تم رفع الصورة بنجاح',
      avatar: url,
    });
  } catch (error: unknown) {
    if (error instanceof UploadValidationError) {
      return badRequest(error.message);
    }
    console.error('Upload avatar error:', error);
    return serverError('فشل رفع الصورة');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) {
      return unauthorized();
    }
    if (auth.sub !== id) {
      return forbidden('يمكنك تغيير صورتك الشخصية فقط');
    }

    const user = await queryOne<{ id: string; phone: string }>(
      `SELECT "id", "phone" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!user) {
      return notFound('المستخدم غير موجود');
    }

    await query(
      `UPDATE "users" SET "avatar" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    await syncServantAvatarForUser(user.id, null);

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: unknown) {
    console.error('Delete avatar error:', error);
    return serverError('فشل حذف الصورة');
  }
}

export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
