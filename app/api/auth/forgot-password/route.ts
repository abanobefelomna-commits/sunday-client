import { queryOne } from '@/src/server/db';
import { createOtp } from '@/src/server/otp';
import { sendOtpEmail } from '@/src/server/email';
import { jsonResponse } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = (body.email || body.phone || '').trim();

    if (identifier) {
      const isEmail = identifier.includes('@');
      const user = await queryOne<{ id: string; email: string; name: string }>(
        isEmail
          ? `SELECT "id", "email", "name" FROM "users" WHERE "email" = $1 LIMIT 1`
          : `SELECT "id", "email", "name" FROM "users" WHERE "phone" = $1 LIMIT 1`,
        [identifier],
      );

      if (user) {
        const { code } = await createOtp(user.id, 'password_reset');
        await sendOtpEmail(user.email, code);
      }
    }
  } catch (error) {
    console.warn('[ForgotPassword] Process error:', error);
  }

  return jsonResponse({
    message: 'إذا كان الحساب مسجلًا، فسيصلك كود استعادة كلمة المرور على بريده الإلكتروني.',
  });
}
