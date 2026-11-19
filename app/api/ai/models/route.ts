import { withTenant } from '@/src/server/tenant/route';
import { getAuthUser, jsonResponse, unauthorized, serverError } from '@/src/server/middleware';
import { aiService } from '@/src/server/ai/service';

async function handler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const models = aiService.getModels();
    const defaultModel = aiService.getDefaultModel();

    const categories = ['Fast', 'General', 'Advanced', 'Coding', 'Writing'];
    const providers = Array.from(
      new Set(models.map((m) => m.providerName)),
    );

    return jsonResponse({
      models,
      defaultModelId: defaultModel.id,
      categories,
      providers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'تعذر تحميل قائمة النماذج';
    return serverError(msg);
  }
}

export const GET = withTenant(handler);
