import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne } from '@/src/server/db';
import { getAuthUser, getAccessContext, jsonResponse, notFound, forbidden, unauthorized, serverError } from '@/src/server/middleware';

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const row = await queryOne<{
      id: string;
      title: string | null;
      content: string;
      image: string | null;
      isPinned: boolean;
      authorName: string | null;
      authorRole: string | null;
      authorId: string | null;
      createdAt: Date;
      updatedAt: Date;
      authorUserName: string | null;
      authorUserRole: string | null;
      authorUserAvatar: string | null;
    }>(
      `SELECT
         n.*,
         u."name" AS "authorUserName",
         u."role" AS "authorUserRole",
         u."avatar" AS "authorUserAvatar"
       FROM "news" n
       LEFT JOIN "users" u ON u."id" = n."authorId"
       WHERE n."id" = $1
       LIMIT 1`,
      [id],
    );

    if (!row) {
      return notFound('الخبر غير موجود');
    }

    return jsonResponse({
      ...row,
      author: row.authorId
        ? {
            id: row.authorId,
            name: row.authorUserName || row.authorName,
            role: row.authorUserRole || row.authorRole,
            avatar: row.authorUserAvatar,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Get news item error:', error);
    return serverError(error.message || 'فشل جلب تفاصيل الخبر');
  }
}

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await req.json();

    const existing = await queryOne<{ id: string; authorId: string | null }>(
      `SELECT "id", "authorId" FROM "news" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!existing) {
      return notFound('الخبر غير موجود');
    }

    const access = await getAccessContext(auth);
    const canEdit =
      access.privileged ||
      access.permissions.includes('news.write') ||
      existing.authorId === auth.sub;
    if (!canEdit) return forbidden('غير مسموح بتعديل هذا الخبر');

    const updated = await queryOne(
      `UPDATE "news"
       SET "title" = CASE WHEN $1::text IS NOT NULL THEN $1 ELSE "title" END,
           "content" = COALESCE($2, "content"),
           "isPinned" = CASE WHEN $3::boolean IS NOT NULL THEN $3 ELSE "isPinned" END,
           "image" = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE "image" END,
           "updatedAt" = now()
       WHERE "id" = $5
       RETURNING *`,
      [
        body.title !== undefined ? body.title : null,
        body.content || null,
        body.isPinned !== undefined ? body.isPinned : null,
        body.image !== undefined ? body.image : null,
        id,
      ],
    );

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Update news error:', error);
    return serverError(error.message || 'فشل تعديل الخبر');
  }
}

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await queryOne<{ id: string; authorId: string | null }>(
      `SELECT "id", "authorId" FROM "news" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!existing) return notFound('الخبر غير موجود');

    const access = await getAccessContext(auth);
    const canDelete =
      access.privileged ||
      access.permissions.includes('news.write') ||
      existing.authorId === auth.sub;
    if (!canDelete) return forbidden('غير مسموح بحذف هذا الخبر');

    await query(`DELETE FROM "news" WHERE "id" = $1`, [id]);
    return jsonResponse({ message: 'تم حذف الخبر بنجاح' });
  } catch (error: any) {
    console.error('Delete news error:', error);
    return serverError(error.message || 'فشل حذف الخبر');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
export const DELETE = withTenant(DELETEHandler);
