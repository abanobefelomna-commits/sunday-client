import { query, queryOne } from '@/src/server/db';
import { hashPassword, verifyPassword } from '@/src/server/auth';
import { getAuthUser, jsonResponse, notFound, unauthorized, badRequest, serverError } from '@/src/server/middleware';

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

    const body = await req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return badRequest('كلمة المرور الحالية والجديدة مطلوبة');
    }

    const user = await queryOne<{ id: string; password: string }>(
      `SELECT "id", "password" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!user) {
      return notFound('المستخدم غير موجود');
    }

    const isValid = await verifyPassword(user.password, oldPassword);
    if (!isValid) {
      return badRequest('كلمة المرور الحالية غير صحيحة');
    }

    const hashedPassword = await hashPassword(newPassword);

    await query(
      `UPDATE "users" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [hashedPassword, id],
    );

    return jsonResponse({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return serverError(error.message || 'حدث خطأ أثناء تغيير كلمة المرور');
  }
}
