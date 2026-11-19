import type {
  AiModel,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatStreamChunk,
} from '../types.ts';

export interface AiProviderAdapter {
  readonly providerId: string;
  readonly name: string;

  isConfigured(): boolean;

  chatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult>;

  streamChatCompletion(
    model: AiModel,
    options: ChatCompletionOptions,
    onChunk: (chunk: ChatStreamChunk) => void,
  ): Promise<void>;
}
