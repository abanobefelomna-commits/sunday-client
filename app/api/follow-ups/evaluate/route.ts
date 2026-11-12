import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { evaluateFollowUps } from '@/src/server/followups';
import { isUuid } from '@/src/server/validation';

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);

    const body = await req.json().catch(() => ({}));
    const classId = isUuid(body?.classId) ? body.classId : null;
    const childId = isUuid(body?.childId) ? body.childId : null;

    const result = await evaluateFollowUps(access, {
      classId,
      childId,
      dryRun: body?.dryRun === true,
    });

    if ('error' in result && result.error === 'forbidden') return forbidden();
    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Evaluate follow-ups error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تقييم قواعد المتابعة');
  }
}

export const POST = withTenant(POSTHandler);
