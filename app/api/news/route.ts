import { query, queryOne } from '@/src/server/db';
import { getAuthUser, jsonResponse, badRequest, serverError } from '@/src/server/middleware';
import { processUploadedImage } from '@/src/server/upload';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const rows = await query<{
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
         n."id",
         n."title",
         n."content",
         n."image",
         n."isPinned",
         n."authorName",
         n."authorRole",
         n."authorId",
         n."createdAt",
         n."updatedAt",
         u."name" AS "authorUserName",
         u."role" AS "authorUserRole",
         u."avatar" AS "authorUserAvatar"
       FROM "news" n
       LEFT JOIN "users" u ON u."id" = n."authorId"
       WHERE ($1::text IS NULL OR n."content" ILIKE '%' || $1 || '%' OR n."title" ILIKE '%' || $1 || '%')
       ORDER BY n."isPinned" DESC, n."createdAt" DESC
       LIMIT $2 OFFSET $3`,
      [search, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "news" n
       WHERE ($1::text IS NULL OR n."content" ILIKE '%' || $1 || '%' OR n."title" ILIKE '%' || $1 || '%')`,
      [search],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      image: r.image,
      isPinned: r.isPinned,
      authorName: r.authorName,
      authorRole: r.authorRole,
      authorId: r.authorId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: r.authorId
        ? {
            id: r.authorId,
            name: r.authorUserName || r.authorName,
            role: r.authorUserRole || r.authorRole,
            avatar: r.authorUserAvatar,
          }
        : null,
    }));

    return jsonResponse({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Get news error:', error);
    return serverError(error.message || 'فشل جلب الأخبار');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    let content = '';
    let title: string | null = null;
    let isPinned = false;
    let imageUrl: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      content = (formData.get('content') as string) || '';
      title = (formData.get('title') as string) || null;
      isPinned = formData.get('isPinned') === 'true';

      const file = formData.get('image') as File | null;
      if (file && file instanceof File && file.size > 0) {
        const upload = await processUploadedImage(file, 'news');
        imageUrl = upload.url;
      }
    } else {
      const body = await req.json();
      content = body.content || '';
      title = body.title || null;
      isPinned = Boolean(body.isPinned);
      imageUrl = body.image || null;
    }

    if (!content.trim()) {
      return badRequest('نص الخبر مطلوب');
    }

    let authorName: string | null = null;
    let authorRole: string | null = null;
    let authorId: string | null = auth?.sub || null;

    if (authorId) {
      const user = await queryOne<{ name: string; role: string }>(
        `SELECT "name", "role" FROM "users" WHERE "id" = $1 LIMIT 1`,
        [authorId],
      );
      if (user) {
        authorName = user.name;
        authorRole = user.role;
      }
    }

    const created = await queryOne(
      `INSERT INTO "news" (
         "id", "title", "content", "image", "isPinned", "authorName", "authorRole", "authorId", "createdAt", "updatedAt"
       )
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [title, content, imageUrl, isPinned, authorName, authorRole, authorId],
    );

    return jsonResponse(created, 201);
  } catch (error: any) {
    console.error('Create news error:', error);
    return serverError(error.message || 'فشل نشر الخبر');
  }
}
