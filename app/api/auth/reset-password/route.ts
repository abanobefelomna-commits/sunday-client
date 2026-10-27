import { query, queryOne } from '@/src/server/db';
import { hashPassword, revokeAllUserRefreshTokens } from '@/src/server/auth';
import { verifyOtp } from '@/src/server/otp';
import { badRequest, jsonResponse, serverError } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = body;
    const identifier = (email || '').trim();

    if (!identifier || !code || !newPassword) {
      return badRequest('البريد الإلكتروني، الكود، وكلمة المرور الجديدة مطلوبة');
    }

    const isEmail = identifier.includes('@');
    const user = await queryOne<{ id: string }>(
      isEmail
        ? `SELECT "id" FROM "users" WHERE "email" = $1 LIMIT 1`
        : `SELECT "id" FROM "users" WHERE "phone" = $1 LIMIT 1`,
      [identifier],
    );

    if (!user) {
      return badRequest('الكود غير صحيح أو انتهت صلاحيته');
    }

    const otpResult = await verifyOtp(user.id, code, 'password_reset');
    if (!otpResult.valid) {
      return badRequest(otpResult.message || 'الكود غير صحيح أو انتهت صلاحيته');
    }

    const hashedPassword = await hashPassword(newPassword);

    await query(
      `UPDATE "users" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [hashedPassword, user.id],
    );

    await revokeAllUserRefreshTokens(user.id);

    return jsonResponse({
      message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول مرة أخرى.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return serverError(error.message || 'حدث خطأ أثناء إعادة تعيين كلمة المرور');
  }
}
