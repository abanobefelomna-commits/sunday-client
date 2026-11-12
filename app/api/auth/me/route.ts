import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, unauthorized } from '@/src/server/middleware';

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

  return jsonResponse({
    ...user,
    servantRole: servant?.role || null,
    classIds,
  });
}

export const GET = withTenant(GETHandler);
