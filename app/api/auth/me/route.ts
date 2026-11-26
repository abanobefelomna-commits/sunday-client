import { withTenant } from '@/src/server/tenant/route';
import { queryOne } from '@/src/server/db';
import { getAccessContext, getAuthUser, jsonResponse, unauthorized } from '@/src/server/middleware';

async function GETHandler(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return unauthorized('لازم تسجّل الدخول الأول');
  }

  const user = await queryOne<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    grades: string[];
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT "id", "name", "email", "phone", "role", "grades", "avatar", "createdAt", "updatedAt"
     FROM "users" WHERE "id" = $1 LIMIT 1`,
    [auth.sub],
  );

  if (!user) {
    return unauthorized('المستخدم غير موجود');
  }

  const access = await getAccessContext(auth);

  return jsonResponse({
    ...user,
    servantRole: access.servantRole,
    servantId: access.servantId,
    classIds: access.classIds,
    ledClassIds: access.ledClassIds ?? [],
    permissions: access.permissions,
  });
}

export const GET = withTenant(GETHandler);
