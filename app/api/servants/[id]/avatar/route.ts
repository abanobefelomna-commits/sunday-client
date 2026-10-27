import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const servant = await queryOne(`SELECT "id" FROM "servants" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!servant) {
      return notFound('الخادم غير موجود');
    }

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
  } catch (error: any) {
    console.error('Upload servant avatar error:', error);
    return badRequest(error.message || 'فشل رفع صورة الخادم');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const servant = await queryOne(`SELECT "id" FROM "servants" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!servant) {
      return notFound('الخادم غير موجود');
    }

    await query(
      `UPDATE "servants" SET "avatar" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: any) {
    console.error('Delete servant avatar error:', error);
    return serverError(error.message || 'فشل حذف صورة الخادم');
  }
}
