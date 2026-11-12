import { withTenant } from '@/src/server/tenant/route';
import { restoreDefaultClasses } from '@/src/server/classes';
import { canManageClassStructure } from '@/src/server/access';
import { recordAudit, requestIp } from '@/src/server/audit';
import { getAccessContext, getAuthUser, jsonResponse, forbidden, serverError, unauthorized, conflict } from '@/src/server/middleware';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function POSTHandler(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const access = await getAccessContext(user);
    if (!canManageClassStructure(access)) return forbidden();

    await restoreDefaultClasses();
    await recordAudit({
      actorId: user.sub,
      action: 'class.restore_defaults',
      entityType: 'class',
      ip: requestIp(req),
    });
    return jsonResponse({ message: 'تمت استعادة الفصول الافتراضية دون حذف السجلات' });
  } catch (error: unknown) {
    if (isUniqueViolation(error) || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'CLASS_DEFAULTS_CONFLICT')) {
      return conflict('تعذّرت الاستعادة لوجود فصل آخر بالاسم نفسه. غيّر الاسم المتعارض أولًا.');
    }
    console.error('Restore default classes error:', error);
    return serverError('تعذّرت استعادة الفصول الافتراضية');
  }
}

export const POST = withTenant(POSTHandler);
