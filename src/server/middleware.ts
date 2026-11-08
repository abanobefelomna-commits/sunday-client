import { NextResponse } from 'next/server';
import { verifyAccessToken, type JwtUserPayload } from './auth';
import type { NextRequest } from 'next/server';
import { query, queryOne } from './db';
import { isPrivilegedRole, type AccessContext } from './access';

export { canReadClass, canWriteClass, canViewPrivateNotes } from './access';
export type { AccessContext } from './access';

/**
 * Resolve the current user's role, linked servant and class scope.
 * Privileged roles (admin / priest / مسؤول / أب كاهن) can access all classes.
 * Every other user is restricted to the classes explicitly assigned to their
 * servant record or matching their grade list.
 */
export async function getAccessContext(user: JwtUserPayload): Promise<AccessContext> {
  const account = await queryOne<{
    role: string;
    phone: string;
    email: string | null;
    grades: string[] | null;
  }>(
    `SELECT "role", "phone", "email", "grades" FROM "users" WHERE "id" = $1 LIMIT 1`,
    [user.sub],
  );

  const servant = account
    ? await queryOne<{ id: string; role: string }>(
        `SELECT "id", "role" FROM "servants"
         WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2)
         LIMIT 1`,
        [account.phone, account.email],
      )
    : null;

  const privileged =
    isPrivilegedRole(user.role, null) ||
    isPrivilegedRole(account?.role, servant?.role);

  const scoped = await query<{ id: string }>(
    `SELECT DISTINCT "id" FROM (
       SELECT sc."classesId" AS "id"
       FROM "servants_classes" sc
       WHERE $1::uuid IS NOT NULL AND sc."servantsId" = $1
       UNION
       SELECT c."id"
       FROM "classes" c
       WHERE COALESCE(array_length($2::users_grades_enum[], 1), 0) > 0
         AND c."grade" = ANY($2::users_grades_enum[])
     ) scoped`,
    [servant?.id ?? null, account?.grades ?? []],
  );

  return {
    privileged,
    classIds: [...new Set(scoped.map((row) => row.id))],
    userId: user.sub,
    role: account?.role || user.role,
    servantId: servant?.id ?? null,
    servantRole: servant?.role ?? null,
  };
}

export async function canManageServants(user: JwtUserPayload): Promise<boolean> {
  const access = await getAccessContext(user);
  return access.privileged;
}

export async function authorizeClass(
  user: JwtUserPayload,
  classId: string | null | undefined,
  allowPrivileged = true,
) {
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

/**
 * Extract a bearer token from the authorization header or the httpOnly-style
 * cookie used by some deployments. Does not throw for unauthenticated requests.
 */
export function getBearerToken(req: Request | NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const [type, token] = authHeader.split(' ');
    if (type === 'Bearer' && token) return token;
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
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
