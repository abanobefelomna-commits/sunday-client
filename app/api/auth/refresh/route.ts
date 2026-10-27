import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryOne } from '@/src/server/db';
import {
  verifyAndRotateRefreshToken,
  issueRefreshToken,
  signAccessToken,
} from '@/src/server/auth';
import { unauthorized, serverError } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    let token: string | undefined;

    // Check cookie first
    const cookieStore = await cookies();
    token = cookieStore.get('refresh_token')?.value;

    // Fallback to body
    if (!token) {
      try {
        const body = await req.json();
        token = body.refreshToken;
      } catch {
        // no body
      }
    }

    if (!token) {
      return unauthorized('توكن التجديد غير موجود');
    }

    const userId = await verifyAndRotateRefreshToken(token);
    if (!userId) {
      return unauthorized('جلسة الدخول منتهية أو غير صالحة');
    }

    const user = await queryOne<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      grades: string[];
      avatar: string | null;
    }>(
      `SELECT "id", "name", "email", "phone", "role", "grades", "avatar"
       FROM "users" WHERE "id" = $1 LIMIT 1`,
      [userId],
    );

    if (!user) {
      return unauthorized('المستخدم غير موجود');
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    const newRefreshToken = await issueRefreshToken(user.id);

    const res = NextResponse.json({
      accessToken,
      user,
      refreshToken: newRefreshToken,
    });

    res.cookies.set('refresh_token', newRefreshToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      expires: newRefreshToken.expiresAt,
    });

    return res;
  } catch (error: any) {
    console.error('Refresh error:', error);
    return serverError(error.message || 'حدث خطأ أثناء تجديد الجلسة');
  }
}
