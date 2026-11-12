import { withTenant } from '@/src/server/tenant/route';
import { queryOne } from '@/src/server/db';
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
import { getStudentProfile } from '@/src/server/students';
import { isUuid } from '@/src/server/validation';

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const { id } = await params;
    if (!isUuid(id)) return badRequest('معرّف الطفل غير صالح');

    const access = await getAccessContext(auth);
    const child = await queryOne<{ classId: string | null; deletedAt: Date | null }>(
      `SELECT "classId", "deletedAt" FROM "children" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!child || child.deletedAt) return notFound('الطفل غير موجود');
    if (!canReadClass(access, child.classId)) return forbidden();

    const { searchParams } = new URL(req.url);
    const timelineLimit = Number.parseInt(searchParams.get('timelineLimit') || '60', 10);
    const historyDays = Number.parseInt(searchParams.get('historyDays') || '180', 10);

    const profile = await getStudentProfile(id, access, {
      timelineLimit: Number.isFinite(timelineLimit) ? timelineLimit : 60,
      historyDays: Number.isFinite(historyDays) ? historyDays : 180,
    });
    if (!profile) return notFound('الطفل غير موجود');

    return jsonResponse(profile);
  } catch (error: unknown) {
    console.error('Get student profile error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب ملف الطالب');
  }
}

export const GET = withTenant(GETHandler);
