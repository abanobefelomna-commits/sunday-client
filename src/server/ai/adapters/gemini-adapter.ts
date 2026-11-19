import { GoogleGenerativeAI, type Content, type GenerationConfig, type Part } from '@google/generative-ai';
import type { AiProviderAdapter } from './provider-adapter.ts';
import type {
  AiContentPart,
  AiModel,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatStreamChunk,
  ChatMessage,
} from '../types.ts';

function toGeminiRole(role: ChatMessage['role']): 'user' | 'model' {
  // Gemini uses 'user' and 'model'; map 'assistant' -> 'model', 'system' is prepended to first user msg
  if (role === 'assistant') return 'model';
  return 'user';
}

function textFromContent(content: string | AiContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((part): part is Extract<AiContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function toGeminiParts(content: string | AiContentPart[]): Part[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.map((part) =>
    part.type === 'text'
      ? { text: part.text }
      : { inlineData: { mimeType: part.mimeType, data: part.data } },
  );
}

function buildContents(messages: ChatMessage[]): {
  systemInstruction: string | undefined;
  contents: Content[];
} {
  let systemInstruction: string | undefined;
  const chatMessages = [...messages];

  // Extract leading system message if present
  if (chatMessages.length > 0 && chatMessages[0].role === 'system') {
    systemInstruction = textFromContent(chatMessages[0].content);
    chatMessages.splice(0, 1);
  }

  const contents: Content[] = chatMessages.map((m) => ({
    role: toGeminiRole(m.role),
    parts: toGeminiParts(m.content),
  }));

  return { systemInstruction, contents };
}

export class GeminiAdapter implements AiProviderAdapter {
  readonly providerId = 'gemini';
  readonly name = 'Google Gemini API';

  private getApiKey(): string {
    return process.env.GEMINI_API_KEY?.trim() || '';
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  private createGenAI(): GoogleGenerativeAI {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    return new GoogleGenerativeAI(apiKey);
  }

  async chatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const genAI = this.createGenAI();
    const { systemInstruction, contents } = buildContents(options.messages);

    const generationConfig: GenerationConfig = {};
    if (model.capabilities.supportsTemperature && options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options.maxTokens) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    const genModel = genAI.getGenerativeModel({
      model: model.apiModelId,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig,
    });

    const start = Date.now();
    const result = await genModel.generateContent({ contents });
    const durationMs = Date.now() - start;

    const candidate = result.response?.candidates?.[0];
    const content = (candidate?.content?.parts ?? [])
      .map((p) => ('text' in p ? p.text : ''))
      .join('')
      .trim();

    const usageMeta = result.response?.usageMetadata;
    const usage = usageMeta
      ? {
          promptTokens: usageMeta.promptTokenCount ?? 0,
          completionTokens: usageMeta.candidatesTokenCount ?? 0,
          totalTokens: usageMeta.totalTokenCount ?? 0,
        }
      : undefined;

    return { content, model: model.id, usage, durationMs };
  }

  async streamChatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
    onChunk: (chunk: ChatStreamChunk) => void,
  ): Promise<void> {
    const genAI = this.createGenAI();
    const { systemInstruction, contents } = buildContents(options.messages);

    const generationConfig: GenerationConfig = {};
    if (model.capabilities.supportsTemperature && options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options.maxTokens) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    const genModel = genAI.getGenerativeModel({
      model: model.apiModelId,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig,
    });

    const streamResult = await genModel.generateContentStream({ contents });

    for await (const chunk of streamResult.stream) {
      const delta = (chunk.candidates?.[0]?.content?.parts ?? [])
        .map((p) => ('text' in p ? p.text : ''))
        .join('');
      if (delta) {
        onChunk({ contentDelta: delta, isComplete: false, model: model.id });
      }
    }

    // Final aggregate for usage
    const finalResponse = await streamResult.response;
    const usageMeta = finalResponse?.usageMetadata;
    const usage = usageMeta
      ? {
          promptTokens: usageMeta.promptTokenCount ?? 0,
          completionTokens: usageMeta.candidatesTokenCount ?? 0,
          totalTokens: usageMeta.totalTokenCount ?? 0,
        }
      : undefined;

    onChunk({ contentDelta: '', isComplete: true, model: model.id, usage });
  }
}
