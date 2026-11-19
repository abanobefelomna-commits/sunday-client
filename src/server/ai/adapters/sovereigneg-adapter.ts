import type { AiProviderAdapter } from './provider-adapter.ts';
import type {
  AiModel,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatStreamChunk,
} from '../types.ts';

export class SovereignEGAdapter implements AiProviderAdapter {
  readonly providerId = 'sovereigneg';
  readonly name = 'SovereignEG OpenAI-Compatible API';

  private getBaseUrl(): string {
    return (
      process.env.SOVEREIGNEG_BASE_URL?.trim() ||
      'https://backend.sovereigneg.com/v1'
    );
  }

  private getApiKey(): string {
    return process.env.SOVEREIGNEG_API_KEY?.trim() || '';
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  private buildPayload(model: AiModel, options: ChatCompletionOptions, stream = false) {
    const caps = model.capabilities;
    const defaultMaxTokens = model.id.includes('oss') ? 2048 : 1500;
    const maxTokens = options.maxTokens ?? defaultMaxTokens;

    const payload: Record<string, unknown> = {
      model: model.apiModelId,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream,
    };

    if (caps.requiresMaxCompletionTokensOnly) {
      payload.max_completion_tokens = maxTokens;
    } else {
      payload.max_tokens = maxTokens;
    }

    if (caps.supportsTemperature && options.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    return payload;
  }

  async chatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SovereignEG API key is not configured.');
    }

    const url = `${this.getBaseUrl()}/chat/completions`;
    const payload = this.buildPayload(model, options, false);
    const start = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      let errorMsg = `Inference failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        } else if (typeof errJson?.message === 'string') {
          errorMsg = errJson.message;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    const content = (msg?.content || '').trim();
    const reasoningContent = (msg?.reasoning_content || msg?.reasoning || '').trim();

    return {
      content,
      reasoningContent: reasoningContent || undefined,
      model: data.model || model.id,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
            reasoningTokens:
              data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          }
        : undefined,
      durationMs,
    };
  }

  async streamChatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
    onChunk: (chunk: ChatStreamChunk) => void,
  ): Promise<void> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SovereignEG API key is not configured.');
    }

    const url = `${this.getBaseUrl()}/chat/completions`;
    const payload = this.buildPayload(model, options, true);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      let errorMsg = `Inference failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) errorMsg = errJson.error.message;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          onChunk({ isComplete: true });
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const choice = json.choices?.[0];
            const delta = choice?.delta;
            const contentDelta = delta?.content ?? '';
            const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning ?? '';
            const usage = json.usage
              ? {
                  promptTokens: json.usage.prompt_tokens ?? 0,
                  completionTokens: json.usage.completion_tokens ?? 0,
                  totalTokens: json.usage.total_tokens ?? 0,
                  reasoningTokens:
                    json.usage.completion_tokens_details?.reasoning_tokens ?? 0,
                }
              : undefined;

            onChunk({
              contentDelta,
              reasoningDelta,
              isComplete: choice?.finish_reason === 'stop',
              model: json.model,
              usage,
            });
          } catch {
            // Ignore partial SSE malformed chunks
          }
        }
      }
    }

    onChunk({ isComplete: true });
  }
}
