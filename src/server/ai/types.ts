export type ModelCategory = 'Fast' | 'General' | 'Advanced' | 'Coding' | 'Writing';

export type ModelStatus = 'live' | 'maintenance' | 'deprecated' | 'unavailable';

export interface ModelPricing {
  inputPer1mEgp: number;
  outputPer1mEgp: number;
  cacheReadPer1mEgp?: number;
  currency: 'EGP' | 'USD';
}

export interface ModelCapabilities {
  supportsTemperature: boolean;
  requiresMaxCompletionTokensOnly?: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsJsonSchema: boolean;
  supportsReasoning?: boolean;
  /** Accepts image content parts (vision / image analysis). */
  supportsVision?: boolean;
  /** Accepts native file content parts such as PDF documents. */
  supportsFiles?: boolean;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
}

export interface AiModel {
  id: string; // Unique registry model ID
  apiModelId: string; // Exact identifier passed to provider API
  name: string; // Display name
  providerId: string; // e.g. "openai", "google", "anthropic", "alibaba", "sovereigneg"
  providerName: string; // Display provider name: "OpenAI", "Google", "Anthropic", "Alibaba", "SovereignEG"
  inferencePlatform: string; // e.g. "SovereignEG"
  description: string; // Short English description
  descriptionAr: string; // Short Arabic description
  category: ModelCategory;
  pricing: ModelPricing | null;
  status: ModelStatus;
  statusNote?: string;
  statusNoteAr?: string;
  capabilities: ModelCapabilities;
  isRecommended?: boolean;
}

export type AiAttachmentKind = 'image' | 'pdf' | 'text';

/** A validated attachment travelling from the browser to the chat endpoint. */
export interface AiAttachmentInput {
  name: string;
  mimeType: string;
  /** Base64 payload without the `data:` URL prefix. */
  data: string;
}

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }
  | { type: 'file'; mimeType: string; filename: string; data: string };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
  reasoningContent?: string;
}

export interface ChatCompletionOptions {
  modelId: string;
  messages: ChatMessage[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCompletionResult {
  content: string;
  reasoningContent?: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
  durationMs: number;
}

export interface ChatStreamChunk {
  contentDelta?: string;
  reasoningDelta?: string;
  isComplete: boolean;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
}
