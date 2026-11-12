import { NextResponse } from 'next/server';
import { verifyAccessToken, type JwtUserPayload } from './auth';
import type { NextRequest } from 'next/server';
import { query, queryOne } from './db';
import { isPrivilegedRole, type AccessContext } from './access';
import { requireTenantContext } from './tenant/context';

export { canReadClass, canWriteClass, canViewPrivateNotes } from './access';
export type { AccessContext } from './access';

/**
 * Resolve the current user's role, linked servant and class scope.
 * Privileged roles (admin / priest / مسؤول / أب كاهن) can access all classes.
 * Every other user is restricted to the classes explicitly assigned to their
 * servant record or matching their grade list.
 */
export type TenantAccessContext = AccessContext & { permissions: string[] };

export async function getAccessContext(user: JwtUserPayload): Promise<TenantAccessContext> {
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
         WHERE "userId" = $3 OR "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2)
         LIMIT 1`,
        [account.phone, account.email, user.sub],
      )
    : null;

  let permissions: string[] = [];
  try {
    const rows = await query<{ code: string }>(
      `SELECT DISTINCT p."code"
       FROM "user_roles" ur
       JOIN "role_permissions" rp ON rp."roleId" = ur."roleId"
       JOIN "permissions" p ON p."code" = rp."permissionCode"
       WHERE ur."userId" = $1`,
      [user.sub],
    );
    permissions = rows.map((row) => row.code);
  } catch {
    // A tenant that has not run the RBAC migration yet keeps legacy access.
  }

  const privileged =
    isPrivilegedRole(user.role, null) ||
    isPrivilegedRole(account?.role, servant?.role) ||
    permissions.includes('settings.write');

  const scoped = await query<{ id: string }>(
    `SELECT DISTINCT "id" FROM (
       SELECT sc."classesId" AS "id"
       FROM "servants_classes" sc
       WHERE $1::uuid IS NOT NULL AND sc."servantsId" = $1
       UNION
       SELECT c."id"
       FROM "classes" c
       WHERE COALESCE(array_length($2::text[], 1), 0) > 0
         AND c."grade"::text = ANY($2::text[])
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
    permissions,
  };
}

export async function canManageServants(user: JwtUserPayload): Promise<boolean> {
  const access = await getAccessContext(user);
  return access.privileged || access.permissions?.includes('servants.write') === true;
}

export async function authorizeClass(
  user: JwtUserPayload,
  classId: string | null | undefined,
  allowPrivileged = true,
) {
  const access = await getAccessContext(user);
  return (allowPrivileged && access.privileged) || (!!classId && access.classIds.includes(classId));
}

/**
 * Authenticate a tenant bearer token and prove it belongs to the tenant
 * resolved from the request host. A token from church A can never be replayed
 * against church B, even if a request parameter is changed.
 */
export async function getAuthUser(req: Request): Promise<JwtUserPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  const user = await verifyAccessToken(token);
  if (!user) return null;

  let tenant;
  try {
    tenant = requireTenantContext();
  } catch {
    return null;
  }
  if (user.tid !== tenant.churchId) return null;
  if (['suspended', 'archived', 'failed', 'pending', 'provisioning'].includes(tenant.status)) {
    return null;
  }
  return user;
}

/**
 * Extract a bearer token from the authorization header. Does not throw for
 * unauthenticated requests.
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
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return NextResponse.json({ message, code, statusCode: 400 }, { status: 400 });
}

export function unauthorized(message = 'لازم تسجّل الدخول الأول') {
  return NextResponse.json({ message, code: 'UNAUTHORIZED', statusCode: 401 }, { status: 401 });
}

export function forbidden(message = 'مش مسموح لك بالوصول', code = 'FORBIDDEN') {
  return NextResponse.json({ message, code, statusCode: 403 }, { status: 403 });
}

export function notFound(message = 'العنصر غير موجود') {
  return NextResponse.json({ message, code: 'NOT_FOUND', statusCode: 404 }, { status: 404 });
}

export function conflict(message: string, code = 'CONFLICT') {
  return NextResponse.json({ message, code, statusCode: 409 }, { status: 409 });
}

export function serverError(message = 'حدث خطأ في الخادم') {
  return NextResponse.json({ message, code: 'SERVER_ERROR', statusCode: 500 }, { status: 500 });
}
