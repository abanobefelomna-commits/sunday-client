import { query, queryOne } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canReadClass,
  jsonResponse,
  badRequest,
  forbidden,
  notFound,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { isUuid } from '@/src/server/validation';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { childId } = await params;
    if (!isUuid(childId)) return badRequest('معرّف الطفل غير صالح');

    const child = await queryOne<{ classId: string | null }>(
      `SELECT "classId" FROM "children" WHERE "id" = $1 LIMIT 1`,
      [childId],
    );
    if (!child) return notFound('الطفل غير موجود');

    const access = await getAccessContext(auth);
    if (!canReadClass(access, child.classId)) return forbidden();

    const rows = await query<{
      id: string;
      childId: string;
      servantId: string | null;
      date: string;
      type: string;
      status: string;
      notes: string | null;
      followUpDate: string | null;
      createdAt: Date;
      updatedAt: Date;
      servantName: string | null;
    }>(
      `SELECT v.*, v."date"::text AS "date", v."followUpDate"::text AS "followUpDate",
              v."type"::text AS "type", v."status"::text AS "status",
              s."name" AS "servantName"
       FROM "visitations" v
       LEFT JOIN "servants" s ON s."id" = v."servantId"
       WHERE v."childId" = $1
       ORDER BY v."date" DESC
       LIMIT 200`,
      [childId],
    );

    const data = rows.map((r) => ({
      ...r,
      servant: r.servantId ? { id: r.servantId, name: r.servantName } : null,
    }));

    return jsonResponse(data);
  } catch (error: unknown) {
    console.error('Get child visitations error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب افتقادات الطفل');
  }
}
