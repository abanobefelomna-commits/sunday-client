import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  jsonResponse,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { listFollowUpRules } from '@/src/server/followups';

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const rules = await listFollowUpRules();
    return jsonResponse({ data: rules });
  } catch (error: unknown) {
    console.error('List follow-up rules error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب قواعد المتابعة');
  }
}

export const GET = withTenant(GETHandler);
