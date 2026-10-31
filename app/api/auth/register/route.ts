import { NextResponse } from 'next/server';
import { queryOne } from '@/src/server/db';
import {
  hashPassword,
  issueRefreshToken,
  signAccessToken,
} from '@/src/server/auth';
import { syncServantFromUser } from '@/src/server/servants';
import { badRequest, conflict, serverError } from '@/src/server/middleware';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      password,
      servantRole = 'servant',
      grades = [],
    } = body;

    const servantRoles = ['servant', 'class_leader', 'admin', 'priest'];
    const validGrades = [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
      'general',
    ];

    if (!name || !email || !phone || !password) {
      return badRequest('الاسم، البريد الإلكتروني، رقم الهاتف، وكلمة المرور مطلوبة');
    }
    if (!servantRoles.includes(servantRole)) {
      return badRequest('الدور المختار غير صالح');
    }
    if (
      !Array.isArray(grades) ||
      grades.some((grade: unknown) => typeof grade !== 'string' || !validGrades.includes(grade))
    ) {
      return badRequest('الفصل أو القسم المختار غير صالح');
    }

    const accountRole = 'servant';
    const assignedGrades = ['admin', 'priest'].includes(servantRole) ? [] : grades;

    // Check existing email or phone
    const existing = await queryOne<{ email: string; phone: string }>(
      `SELECT "email", "phone" FROM "users" WHERE "email" = $1 OR "phone" = $2 LIMIT 1`,
      [email, phone],
    );

    if (existing) {
      return conflict(
        existing.email === email
          ? 'الإيميل مستخدم بالفعل'
          : 'رقم التليفون مستخدم بالفعل',
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await queryOne<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      grades: string[];
      avatar: string | null;
    }>(
      `INSERT INTO "users" ("id", "name", "email", "emailVerified", "phone", "password", "role", "grades", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, true, $3, $4, $5, $6::users_grades_enum[], now(), now())
       RETURNING "id", "name", "email", "phone", "role", "grades", "avatar"`,
      [name, email, phone, hashedPassword, accountRole, assignedGrades],
    );

    if (!user) {
      return serverError('فشل إنشاء الحساب');
    }

    // Sync servant
    await syncServantFromUser({
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      servantRole,
      avatar: user.avatar,
      grades: user.grades,
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    const refreshToken = await issueRefreshToken(user.id);

    const res = NextResponse.json({
      accessToken,
      user,
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
  } catch (error: unknown) {
    console.error('Registration error:', error);
    return serverError(
      error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء الحساب',
    );
  }
}
