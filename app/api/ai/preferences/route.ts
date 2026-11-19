import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  jsonResponse,
  unauthorized,
  badRequest,
  serverError,
} from '@/src/server/middleware';
import { queryOne, query } from '@/src/server/db';
import { getModelById } from '@/src/server/ai/registry';

async function getHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const row = await queryOne<{ value: string }>(
      `SELECT "value" FROM "church_settings" WHERE "key" = 'ai.defaultModel' LIMIT 1`,
    );

    let defaultModelId = 'gpt-6-luna';
    if (row?.value) {
      try {
        defaultModelId = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      } catch {
        defaultModelId = String(row.value);
      }
    }

    return jsonResponse({ defaultModelId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'تعذر استرجاع الإعدادات';
    return serverError(msg);
  }
}

async function postHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { modelId } = body;

    if (!modelId || typeof modelId !== 'string') {
      return badRequest('معرف النموذج مطلوب.');
    }

    const model = getModelById(modelId);
    if (!model || model.status !== 'live') {
      return badRequest('النموذج المحدد غير صالح أو غير متاح.');
    }

    await query(
      `INSERT INTO "church_settings" ("key", "value", "updatedAt")
       VALUES ('ai.defaultModel', to_jsonb($1::text), now())
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`,
      [modelId],
    );

    return jsonResponse({ success: true, defaultModelId: modelId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'تعذر حفظ الإعدادات';
    return serverError(msg);
  }
}

export const GET = withTenant(getHandler);
export const POST = withTenant(postHandler);
