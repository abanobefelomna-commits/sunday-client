import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  jsonResponse,
  badRequest,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isUuid } from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20));

    const rows = await query<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      entityType: string | null;
      entityId: string | null;
      readAt: Date | null;
      createdAt: Date;
    }>(
      `SELECT "id", "type", "title", "body", "entityType", "entityId", "readAt", "createdAt"
       FROM "notifications"
       WHERE "userId" = $1 AND ($2::boolean = false OR "readAt" IS NULL)
       ORDER BY "createdAt" DESC
       LIMIT $3`,
      [auth.sub, unreadOnly, limit],
    );

    const counts = await queryOne<{ total: number; unread: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE "readAt" IS NULL)::int AS unread
       FROM "notifications" WHERE "userId" = $1`,
      [auth.sub],
    );

    return jsonResponse({
      data: rows,
      meta: {
        total: counts?.total ?? 0,
        unread: counts?.unread ?? 0,
        limit,
      },
    });
  } catch (error: unknown) {
    console.error('List notifications error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب التنبيهات');
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as {
      ids?: unknown;
      all?: unknown;
      read?: unknown;
    };

    const read = body.read !== false;

    if (body.all === true) {
      await query(
        `UPDATE "notifications" SET "readAt" = CASE WHEN $2::boolean THEN now() ELSE NULL END
         WHERE "userId" = $1 AND (($2::boolean = true AND "readAt" IS NULL) OR $2::boolean = false)`,
        [auth.sub, read],
      );
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.filter((value): value is string => isUuid(value)).slice(0, 100);
      if (ids.length === 0) return badRequest('لا توجد تنبيهات صالحة');
      await query(
        `UPDATE "notifications"
         SET "readAt" = CASE WHEN $3::boolean THEN now() ELSE NULL END
         WHERE "userId" = $1 AND "id" = ANY($2::uuid[])`,
        [auth.sub, ids, read],
      );
    } else {
      return badRequest('حدّد التنبيهات المطلوب تحديثها');
    }

    return jsonResponse({ message: read ? 'تم تعليم التنبيهات كمقروءة' : 'تم تعليم التنبيهات كغير مقروءة' });
  } catch (error: unknown) {
    console.error('Update notifications error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تحديث التنبيهات');
  }
}
