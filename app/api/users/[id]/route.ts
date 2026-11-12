import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  notFound,
  conflict,
  badRequest,
  serverError,
  unauthorized,
  forbidden,
} from '@/src/server/middleware';
import { syncServantFromUser } from '@/src/server/servants';
import { isUuid } from '@/src/server/validation';

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    if (!isUuid(id)) return notFound('المستخدم غير موجود');

    if (auth.sub !== id) {
      const access = await getAccessContext(auth);
      const allowed =
        access.privileged ||
        access.permissions.includes('users.read') ||
        access.permissions.includes('servants.read');
      if (!allowed) return forbidden('غير مسموح بعرض بيانات مستخدم آخر');
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
      [id],
    );

    if (!user) return notFound('المستخدم غير موجود');

    return jsonResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return serverError('تعذر جلب بيانات المستخدم');
  }
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) return unauthorized();
    if (!isUuid(id)) return notFound('المستخدم غير موجود');

    const isSelf = auth.sub === id;
    const access = await getAccessContext(auth);
    const canManage = access.privileged || access.permissions.includes('users.write');
    if (!isSelf && !canManage) {
      return forbidden('غير مسموح بتعديل بيانات مستخدم آخر');
    }

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : null;
    const rawGrades = body.grades;

    if (name !== null && name.length === 0) {
      return badRequest('الاسم مطلوب');
    }

    let grades: string[] | null = null;
    if (rawGrades !== undefined) {
      if (!canManage) {
        return forbidden('تعديل الفصول يحتاج صلاحية إدارة المستخدمين');
      }
      if (!Array.isArray(rawGrades) || rawGrades.some((value) => typeof value !== 'string')) {
        return badRequest('قائمة الفصول غير صالحة');
      }
      grades = rawGrades as string[];
    }

    const existingUser = await queryOne<{ id: string; email: string; role: string; avatar: string | null }>(
      `SELECT "id", "email", "role", "avatar" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!existingUser) return notFound('المستخدم غير موجود');

    if (phone) {
      const phoneTaken = await queryOne<{ id: string }>(
        `SELECT "id" FROM "users" WHERE "phone" = $1 AND "id" != $2 LIMIT 1`,
        [phone, id],
      );
      if (phoneTaken) return conflict('رقم التليفون مستخدم بالفعل بحساب آخر');
    }

    const updatedUser = await queryOne<{
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
      `UPDATE "users"
       SET "name" = COALESCE($1, "name"),
           "phone" = COALESCE($2, "phone"),
           "grades" = COALESCE($3::users_grades_enum[], "grades"),
           "updatedAt" = now()
       WHERE "id" = $4
       RETURNING "id", "name", "email", "phone", "role", "grades", "avatar", "createdAt", "updatedAt"`,
      [name || null, phone || null, grades, id],
    );

    if (!updatedUser) return serverError('تعذر تحديث البيانات');

    await syncServantFromUser({
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      grades: grades ?? undefined,
    });

    return jsonResponse(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    return serverError('حدث خطأ أثناء تعديل البيانات');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
