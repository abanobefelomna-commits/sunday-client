import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  jsonResponse,
  badRequest,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/src/server/notifications';

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    return jsonResponse(await getNotificationPreferences(auth.sub));
  } catch (error: unknown) {
    console.error('Get notification preferences error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل جلب تفضيلات التنبيهات');
  }
}

const KEYS: Array<keyof NotificationPreferences> = [
  'followUpAssigned',
  'followUpOverdue',
  'followUpCompleted',
  'attendanceAlert',
];

async function PATCHHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Partial<NotificationPreferences> = {};
    for (const key of KEYS) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') return badRequest('قيمة التفضيل غير صالحة');
        patch[key] = body[key] as boolean;
      }
    }
    if (Object.keys(patch).length === 0) return badRequest('لا توجد تفضيلات للتحديث');

    return jsonResponse(await updateNotificationPreferences(auth.sub, patch));
  } catch (error: unknown) {
    console.error('Update notification preferences error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تحديث تفضيلات التنبيهات');
  }
}

export const GET = withTenant(GETHandler);
export const PATCH = withTenant(PATCHHandler);
