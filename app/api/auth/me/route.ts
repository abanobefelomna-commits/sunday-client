import { queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, unauthorized } from '@/src/server/middleware';

export async function GET(req: Request) {
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

  return jsonResponse(user);
}
