import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, notFound, conflict, serverError, unauthorized } from '@/src/server/middleware';
import { syncServantFromUser } from '@/src/server/servants';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  if (!user) {
    return notFound('المستخدم غير موجود');
  }

  return jsonResponse(user);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    const { id } = await params;

    if (!auth) {
      return unauthorized();
    }

    const body = await req.json();
    const { name, phone, grades } = body;

    const existingUser = await queryOne<{ id: string; email: string; role: string; avatar: string | null }>(
      `SELECT "id", "email", "role", "avatar" FROM "users" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!existingUser) {
      return notFound('المستخدم غير موجود');
    }

    if (phone) {
      const phoneTaken = await queryOne<{ id: string }>(
        `SELECT "id" FROM "users" WHERE "phone" = $1 AND "id" != $2 LIMIT 1`,
        [phone, id],
      );
      if (phoneTaken) {
        return conflict('رقم التليفون مستخدم بالفعل بحساب آخر');
      }
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
           "grades" = COALESCE($3, "grades"),
           "updatedAt" = now()
       WHERE "id" = $4
       RETURNING "id", "name", "email", "phone", "role", "grades", "avatar", "createdAt", "updatedAt"`,
      [name || null, phone || null, grades || null, id],
    );

    if (!updatedUser) {
      return serverError('تعذر تحديث البيانات');
    }

    // Sync servant record
    await syncServantFromUser({
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      grades: updatedUser.grades,
    });

    return jsonResponse(updatedUser);
  } catch (error: any) {
    console.error('Update profile error:', error);
    return serverError(error.message || 'حدث خطأ أثناء تعديل البيانات');
  }
}
