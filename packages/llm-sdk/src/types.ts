import type { ChatMessage } from '@olive/shared';

/** Token accounting returned by a provider (or estimated when unavailable). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** True when counts are estimated locally rather than reported by the provider. */
  estimated: boolean;
}

/** A streamed unit of provider output. */
export interface StreamChunk {
  /** Incremental text. Empty string on the terminal chunk. */
  delta: string;
  done: boolean;
  /** Present only on the terminal chunk. */
  usage?: TokenUsage;
}

/** A normalized request passed to any provider. */
export interface ProviderRequest {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/**
 * The provider contract. Every provider — Gemini, OpenAI, Mock — implements
 * exactly this, which is what makes the SDK genuinely multi-provider: callers
 * never branch on provider type.
 */
export interface LLMProvider {
  readonly name: string;
  /** Streams output chunks; the final chunk carries `usage`. */
  streamChat(req: ProviderRequest): AsyncIterable<StreamChunk>;
}

/** Raised by providers when a request is aborted via `AbortSignal`. */
export class ProviderAbortError extends Error {
  constructor() {
    super('Inference cancelled by caller');
    this.name = 'ProviderAbortError';
  }
}
