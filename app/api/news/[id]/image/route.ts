import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const news = await queryOne(`SELECT "id" FROM "news" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!news) {
      return notFound('الخبر غير موجود');
    }

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
  } catch (error: any) {
    console.error('Upload news image error:', error);
    return badRequest(error.message || 'فشل رفع صورة الخبر');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const news = await queryOne(`SELECT "id" FROM "news" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!news) {
      return notFound('الخبر غير موجود');
    }

    await query(
      `UPDATE "news" SET "image" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    return jsonResponse({ message: 'تم حذف صورة الخبر بنجاح' });
  } catch (error: any) {
    console.error('Delete news image error:', error);
    return serverError(error.message || 'فشل حذف صورة الخبر');
  }
}
