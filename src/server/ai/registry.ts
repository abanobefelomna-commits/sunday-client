import type { AiModel } from './types.ts';

export const AI_MODELS: AiModel[] = [
  // 1. OpenAI GPT-6 Luna (Fast)
  {
    id: 'gpt-6-luna',
    apiModelId: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    providerId: 'openai',
    providerName: 'OpenAI',
    inferencePlatform: 'SovereignEG',
    description: 'Fast, cost-efficient model in OpenAI GPT-6 series. 1.05M context with fast response times.',
    descriptionAr: 'نموذج فائق السرعة واقتصادي من سلسلة GPT-6، بسياق 1.05 مليون توكن واستجابة فورية ممتازة.',
    category: 'Fast',
    pricing: {
      inputPer1mEgp: 5.9125,
      outputPer1mEgp: 29.5627,
      cacheReadPer1mEgp: 0.5913,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: false,
      requiresMaxCompletionTokensOnly: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1050000,
      maxOutputTokens: 128000,
    },
    isRecommended: true,
  },

  // 2. OpenAI GPT-OSS 20B (General / Open-Weight)
  {
    id: 'gpt-oss-20b',
    apiModelId: 'gpt-oss-20b',
    name: 'GPT-OSS 20B',
    providerId: 'openai',
    providerName: 'OpenAI',
    inferencePlatform: 'SovereignEG',
    description: 'OpenAI open-weight 21B MoE model (3.6B active) with native chain-of-thought and low latency.',
    descriptionAr: 'نموذج مفتوح الأوزان 21B MoE من OpenAI يدعم التفكير المنطقي التلقائي مع تكلفة اقتصادية جداً.',
    category: 'General',
    pricing: {
      inputPer1mEgp: 1.7738,
      outputPer1mEgp: 8.2775,
      cacheReadPer1mEgp: 0.8869,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 131072,
      maxOutputTokens: 16384,
    },
  },

  // 3. OpenAI GPT-OSS 120B (Advanced Reasoning)
  {
    id: 'gpt-oss-120b',
    apiModelId: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    providerId: 'openai',
    providerName: 'OpenAI',
    inferencePlatform: 'SovereignEG',
    description: 'Flagship open-weight 117B MoE model for deep theological reasoning, curriculum analysis, and planning.',
    descriptionAr: 'نموذج عملاق مفتوح الأوزان 117B MoE للاستنتاج التعليمي المعمق وتحليل التقارير الرعوية المعقدة.',
    category: 'Advanced',
    pricing: {
      inputPer1mEgp: 2.1876,
      outputPer1mEgp: 10.0513,
      cacheReadPer1mEgp: 1.0938,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 131072,
      maxOutputTokens: 16384,
    },
  },

  // 4. Google Gemini 3.8 Flash (Fast / served exclusively through SovereignEG)
  {
    id: 'gemini-3.8-flash',
    apiModelId: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    providerId: 'google',
    providerName: 'Google',
    inferencePlatform: 'SovereignEG',
    description: 'Google Gemini 3.8 Flash, served through the SovereignEG gateway for fast responses and Arabic nuance.',
    descriptionAr: 'نموذج جيميني 3.8 فلاش من جوجل، يُقدَّم عبر بوابة SovereignEG بسرعة عالية وجودة عربية ممتازة.',
    category: 'Fast',
    pricing: { inputPer1mEgp: 5.0, outputPer1mEgp: 15.0, currency: 'EGP' },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1000000,
      maxOutputTokens: 16384,
    },
  },

  // 5. Google Gemini 4 Argon (Advanced / Multilingual)
  {
    id: 'gemini-4-argon',
    apiModelId: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    providerId: 'google',
    providerName: 'Google',
    inferencePlatform: 'SovereignEG',
    description: "Google's next-generation multimodal model with deep Arabic comprehension and lesson planning acumen.",
    descriptionAr: 'الجيل الرابع من نماذج جوجل المتطورة، بقدرات استثنائية في فهم وتوليد المحتوى باللغة العربية.',
    category: 'Advanced',
    pricing: {
      inputPer1mEgp: 118.2507,
      outputPer1mEgp: 591.2533,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1050000,
      maxOutputTokens: 128000,
    },
  },

  // 5. Alibaba Qwen 3.8 Flash (Fast / Arabic Nuance)
  {
    id: 'qwen3.8-flash',
    apiModelId: 'qwen3.8-flash',
    name: 'Qwen 3.8 Flash',
    providerId: 'alibaba',
    providerName: 'Alibaba Qwen',
    inferencePlatform: 'SovereignEG',
    description: 'High-speed model from Alibaba optimized for natural Arabic dialogue and quick pedagogical assistance.',
    descriptionAr: 'نموذج فائق الخفة والسرعة من Qwen، متميز بفصاحة وبلاغة عربية وسرعة فائقة في الإجابة.',
    category: 'Fast',
    pricing: {
      inputPer1mEgp: 6.6812,
      outputPer1mEgp: 22.5859,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1000000,
      maxOutputTokens: 16384,
    },
  },

  // 6. Anthropic Claude Sonnet 5.5 (Writing / Pedagogical Quality)
  {
    id: 'claude-sonnet-5.5',
    apiModelId: 'claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    inferencePlatform: 'SovereignEG',
    description: "Anthropic's premier model for nuanced, thoughtful Christian education writing and pastoral care.",
    descriptionAr: 'نموذج أنثروبيك المتميز في كتابة وتحضير الدروس، الصياغة التربوية الروحية، والأسلوب الرعوي الهادئ.',
    category: 'Writing',
    pricing: {
      inputPer1mEgp: 118.2507,
      outputPer1mEgp: 591.2533,
      cacheReadPer1mEgp: 5.9125,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: false,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
    },
  },

  // 7. Anthropic Claude Haiku 5.5 (Fast / Summaries)
  {
    id: 'claude-haiku-5.5',
    apiModelId: 'claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    inferencePlatform: 'SovereignEG',
    description: 'Fast, compact model from Anthropic for quick quiz generation and immediate feedback.',
    descriptionAr: 'نموذج سريع وموجز من عائلة كلود، ممتاز لتوليد الأسئلة السريعة والمسابقات الدينية.',
    category: 'Fast',
    pricing: {
      inputPer1mEgp: 5.9125,
      outputPer1mEgp: 29.5627,
      cacheReadPer1mEgp: 0.5913,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: false,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: false,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
    },
  },

  // 8. Alibaba Qwen 3 Coder Flash (Coding / Structured Data)
  {
    id: 'qwen3-coder-flash',
    apiModelId: 'qwen3-coder-flash',
    name: 'Qwen 3 Coder Flash',
    providerId: 'alibaba',
    providerName: 'Alibaba Qwen',
    inferencePlatform: 'SovereignEG',
    description: 'Specialized model for attendance analysis scripts, structured data exports, and coding help.',
    descriptionAr: 'نموذج متخصص في البرمجة وهيكلة البيانات وتحليل جداول الحضور وسجلات الخدمة برمجياً.',
    category: 'Coding',
    pricing: {
      inputPer1mEgp: 11.5294,
      outputPer1mEgp: 57.6472,
      currency: 'EGP',
    },
    status: 'live',
    capabilities: {
      supportsTemperature: true,
      supportsTools: true,
      supportsStreaming: true,
      supportsJsonSchema: true,
      supportsReasoning: true,
      contextWindow: 1000000,
      maxOutputTokens: 16384,
    },
  },

  // 9. Claude 3.5 Sonnet (Explicit verification - marked unavailable)
  {
    id: 'claude-3-5-sonnet',
    apiModelId: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    inferencePlatform: 'SovereignEG',
    description: 'Requested model ID verified not available in the active provider inference catalog.',
    descriptionAr: 'تم التحقق من عدم توفر هذا المعرف في مزود الخدمة حاليًا؛ يرجى استخدام Claude Sonnet 5.5 كبديل معتمد.',
    category: 'Advanced',
    pricing: null,
    status: 'unavailable',
    statusNote: 'Not available in SovereignEG catalog. Upgraded to Claude Sonnet 5.5.',
    statusNoteAr: 'معرف غير متاح لدى مزود الخدمة. البديل المعتمد والأحدث هو Claude Sonnet 5.5.',
    capabilities: {
      supportsTemperature: false,
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonSchema: false,
    },
  },
];

export const DEFAULT_MODEL_ID = 'gpt-6-luna';

export function getModelById(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getAllModels(): AiModel[] {
  return AI_MODELS;
}

export function getAvailableModels(): AiModel[] {
  return AI_MODELS.filter((m) => m.status === 'live');
}
