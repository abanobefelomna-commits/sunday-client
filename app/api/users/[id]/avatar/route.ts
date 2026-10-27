import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, notFound, unauthorized, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';
import { syncServantAvatarByPhone } from '@/src/server/servants';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) {
      return unauthorized();
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

    await syncServantAvatarByPhone(user.phone, url);

    return jsonResponse({
      message: 'تم رفع الصورة بنجاح',
      avatar: url,
    });
  } catch (error: any) {
    console.error('Upload avatar error:', error);
    return badRequest(error.message || 'فشل رفع الصورة');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) {
      return unauthorized();
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

    await syncServantAvatarByPhone(user.phone, null);

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: any) {
    console.error('Delete avatar error:', error);
    return serverError(error.message || 'فشل حذف الصورة');
  }
}
