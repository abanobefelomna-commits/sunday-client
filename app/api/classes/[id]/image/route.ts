import { query, queryOne } from '@/src/server/db';
import { jsonResponse, notFound, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cls = await queryOne(`SELECT "id" FROM "classes" WHERE "id" = $1 LIMIT 1`, [id]);
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
      `UPDATE "classes" SET "image" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [url, id],
    );

    return jsonResponse({
      message: 'تم رفع الصورة بنجاح',
      image: url,
    });
  } catch (error: any) {
    console.error('Upload class image error:', error);
    return badRequest(error.message || 'فشل رفع صورة الفصل');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cls = await queryOne(`SELECT "id" FROM "classes" WHERE "id" = $1 LIMIT 1`, [id]);
    if (!cls) {
      return notFound('الفصل غير موجود');
    }

    await query(
      `UPDATE "classes" SET "image" = NULL, "updatedAt" = now() WHERE "id" = $1`,
      [id],
    );

    return jsonResponse({ message: 'تم حذف الصورة بنجاح' });
  } catch (error: any) {
    console.error('Delete class image error:', error);
    return serverError(error.message || 'فشل حذف صورة الفصل');
  }
}
