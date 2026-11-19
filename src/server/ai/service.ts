import type { AiProviderAdapter } from './adapters/provider-adapter.ts';
import { SovereignEGAdapter } from './adapters/sovereigneg-adapter.ts';
import { GeminiAdapter } from './adapters/gemini-adapter.ts';
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  getAllModels,
  getModelById,
} from './registry.ts';
import type {
  AiModel,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatStreamChunk,
} from './types.ts';

class AiService {
  private adapters = new Map<string, AiProviderAdapter>();

  constructor() {
    const sovereignEg = new SovereignEGAdapter();
    this.adapters.set(sovereignEg.providerId, sovereignEg);
    const gemini = new GeminiAdapter();
    this.adapters.set(gemini.providerId, gemini);
  }

  registerAdapter(adapter: AiProviderAdapter) {
    this.adapters.set(adapter.providerId, adapter);
  }

  getAdapter(providerId: string): AiProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getModels(): AiModel[] {
    return getAllModels();
  }

  getDefaultModel(): AiModel {
    return getModelById(DEFAULT_MODEL_ID) || AI_MODELS[0];
  }

  resolveModelAndAdapter(modelId: string): {
    model: AiModel;
    adapter: AiProviderAdapter;
  } {
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(
        `النموذج المطلوب (${modelId}) غير موجود في النظام. يرجى اختيار نموذج من القائمة المتاحة.`,
      );
    }

    if (model.status !== 'live') {
      const note = model.statusNoteAr || model.statusNote || 'النموذج غير متاح حاليًا.';
      throw new Error(`النموذج (${model.name}) غير متاح للتشغيل: ${note}`);
    }

    // Models are served either directly by their provider (Gemini) or through
    // the SovereignEG gateway. The registry keeps the upstream provider in
    // `providerId`, so route by inference platform first instead of assuming
    // the upstream provider is the adapter key.
    const adapterId =
      model.inferencePlatform === 'SovereignEG'
        ? 'sovereigneg'
        : model.inferencePlatform === 'Google Gemini API'
          ? 'gemini'
          : model.providerId;
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`مزود خدمة الذكاء الاصطناعي (${adapterId}) غير متوفر.`);
    }

    if (!adapter.isConfigured()) {
      throw new Error(
        `مفتاح الاتصال بمزود الذكاء الاصطناعي (${model.providerId}) غير مهيأ في الخادم.`,
      );
    }

    return { model, adapter };
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const { model, adapter } = this.resolveModelAndAdapter(options.modelId);
    return adapter.chatCompletion(model, options);
  }

  async streamChat(
    options: ChatCompletionOptions,
    onChunk: (chunk: ChatStreamChunk) => void,
  ): Promise<void> {
    const { model, adapter } = this.resolveModelAndAdapter(options.modelId);
    return adapter.streamChatCompletion(model, options, onChunk);
  }
}

export const aiService = new AiService();
