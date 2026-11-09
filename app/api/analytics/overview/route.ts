import { getAuthUser, getAccessContext, canReadClass, jsonResponse, forbidden, unauthorized, serverError } from '@/src/server/middleware';
import { getAnalyticsOverview } from '@/src/server/analytics';
import { isUuid, parseDateRange, ValidationError } from '@/src/server/validation';

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const { searchParams } = new URL(req.url);
    const classId = isUuid(searchParams.get('classId')) ? searchParams.get('classId') : null;
    if (classId && !canReadClass(access, classId)) return forbidden();

    const range = parseDateRange(searchParams, { defaultDays: 90, maxDays: 366 });
    const overview = await getAnalyticsOverview(access, { ...range, classId });

    return jsonResponse(overview);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return jsonResponse({ message: error.message }, 400);
    }
    console.error('Analytics overview error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب التحليلات');
  }
}
