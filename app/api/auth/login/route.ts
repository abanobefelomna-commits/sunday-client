import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import {
  verifyPassword,
  issueRefreshToken,
  signAccessToken,
} from '@/src/server/auth';
import { badRequest, unauthorized, serverError } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone, password } = body;
    const identifier = (email || phone || '').trim();

    if (!identifier || !password) {
      return badRequest('البريد الإلكتروني أو رقم الهاتف وكلمة المرور مطلوبة');
    }

    const isEmail = identifier.includes('@');
    const user = await queryOne<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      grades: string[];
      avatar: string | null;
      password: string;
    }>(
      isEmail
        ? `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "password"
           FROM "users" WHERE "email" = $1 LIMIT 1`
        : `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "password"
           FROM "users" WHERE "phone" = $1 LIMIT 1`,
      [identifier],
    );

    if (!user) {
      return unauthorized('الإيميل أو الباسورد غلط');
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      return unauthorized('الإيميل أو الباسورد غلط');
    }

    const { password: _pw, ...safeUser } = user;

    const servant = await queryOne<{ id: string; role: string }>(
      `SELECT "id", "role" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`,
      [user.phone, user.email],
    );

    let classIds: string[] = [];
    if (servant) {
      const sc = await query<{ classesId: string }>(
        `SELECT "classesId" FROM "servants_classes" WHERE "servantsId" = $1`,
        [servant.id],
      );
      classIds.push(...sc.map((r) => r.classesId));
    }
    if (user.grades && user.grades.length > 0) {
      const gc = await query<{ id: string }>(
        `SELECT "id" FROM "classes" WHERE "grade"::text = ANY($1::text[])`,
        [user.grades],
      );
      classIds.push(...gc.map((r) => r.id));
    }
    classIds = [...new Set(classIds)];

    const safeUserWithRole = {
      ...safeUser,
      servantRole: servant?.role || null,
      classIds,
    };

    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    const refreshToken = await issueRefreshToken(user.id);

    const res = NextResponse.json({
      accessToken,
      user: safeUserWithRole,
      refreshToken,
    });

    res.cookies.set('refresh_token', refreshToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      expires: refreshToken.expiresAt,
    });

    return res;
  } catch (error: any) {
    console.error('Login error:', error);
    return serverError(error.message || 'حدث خطأ أثناء تسجيل الدخول');
  }
}
