import { NextResponse } from 'next/server';
import { verifyAccessToken, type JwtUserPayload } from './auth';
import { query, queryOne } from './db';

export type AccessContext = { privileged: boolean; classIds: string[] };

export async function getAccessContext(user: JwtUserPayload): Promise<AccessContext> {
  const account = await queryOne<{ role: string; phone: string; email: string | null; grades: string[] | null }>(
    `SELECT "role", "phone", "email", "grades" FROM "users" WHERE "id" = $1`, [user.sub],
  );
  const servant = account ? await queryOne<{ id: string; role: string }>(
    `SELECT "id", "role" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`,
    [account.phone, account.email],
  ) : null;
  const privileged = ['admin', 'priest'].includes(user.role) || ['admin', 'priest'].includes(account?.role || '') || ['مسؤول', 'كاهن', 'أب كاهن'].includes(servant?.role || '');
  if (privileged) return { privileged, classIds: [] };
  const assigned = servant ? await query<{ classesId: string }>(`SELECT "classesId" FROM "servants_classes" WHERE "servantsId" = $1`, [servant.id]) : [];
  const graded = account?.grades?.length ? await query<{ id: string }>(`SELECT "id" FROM "classes" WHERE "grade" = ANY($1::classes_grade_enum[])`, [account.grades]) : [];
  return { privileged: false, classIds: [...new Set([...assigned.map(x => x.classesId), ...graded.map(x => x.id)])] };
}

export async function authorizeClass(user: JwtUserPayload, classId: string | null | undefined, allowPrivileged = true) {
  const access = await getAccessContext(user);
  return (allowPrivileged && access.privileged) || (!!classId && access.classIds.includes(classId));
}

export async function getAuthUser(req: Request): Promise<JwtUserPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  return verifyAccessToken(token);
}

export function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers });
}

export function badRequest(message: string) {
  return NextResponse.json({ message, statusCode: 400 }, { status: 400 });
}

export function unauthorized(message = 'لازم تسجّل الدخول الأول') {
  return NextResponse.json({ message, statusCode: 401 }, { status: 401 });
}

export function forbidden(message = 'مش مسموح لك بالوصول') {
  return NextResponse.json({ message, statusCode: 403 }, { status: 403 });
}

export function notFound(message = 'العنصر غير موجود') {
  return NextResponse.json({ message, statusCode: 404 }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ message, statusCode: 409 }, { status: 409 });
}

export function serverError(message = 'حدث خطأ في الخادم') {
  return NextResponse.json({ message, statusCode: 500 }, { status: 500 });
}
