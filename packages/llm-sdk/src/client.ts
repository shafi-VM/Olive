import { randomUUID } from 'node:crypto';
import { type ChatMessage, type InferenceStatus, type Logger } from '@olive/shared';
import type { LogShipper } from './shipper.js';
import { buildInferenceLog } from './telemetry.js';
import { type LLMProvider, ProviderAbortError, type TokenUsage } from './types.js';

export interface StreamChatOptions {
  provider: string;
  model: string;
  messages: ChatMessage[];
  conversationId?: string;
  messageId?: string;
  /** Provide to correlate the log with an externally-known request id. */
  requestId?: string;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  requestId: string;
  status: InferenceStatus;
  usage?: TokenUsage;
  output: string;
}

export interface LLMClientOptions {
  providers: Record<string, LLMProvider>;
  shipper: LogShipper;
  logger: Logger;
}

/**
 * The instrumented LLM client. Wraps any registered provider and, on every
 * call, captures latency / tokens / status / previews and ships one inference
 * log — without the caller writing any telemetry code.
 */
export class OliveLLMClient {
  readonly #providers: Record<string, LLMProvider>;
  readonly #shipper: LogShipper;
  readonly #logger: Logger;

  constructor(opts: LLMClientOptions) {
    this.#providers = opts.providers;
    this.#shipper = opts.shipper;
    this.#logger = opts.logger;
  }

  /** Names of providers that are configured and usable. */
  listProviders(): string[] {
    return Object.keys(this.#providers);
  }

  /**
   * Streams assistant text deltas. Telemetry is emitted exactly once when the
   * stream settles — success, error, or early cancellation — via a `finally`
   * block, so a log is produced even if the caller stops iterating. The
   * generator's return value carries the final `StreamChatResult`.
   */
  async *streamChat(opts: StreamChatOptions): AsyncGenerator<string, StreamChatResult> {
    const provider = this.#providers[opts.provider];
    if (!provider) {
      throw new Error(`Unknown or unconfigured provider: ${opts.provider}`);
    }

    const requestId = opts.requestId ?? randomUUID();
    const startedAt = new Date();
    const inputPreview =
      [...opts.messages].reverse().find((m: ChatMessage) => m.role === 'user')?.content ?? '';

    let output = '';
    let usage: TokenUsage | undefined;
    let status: InferenceStatus = 'success';
    let errorType: string | undefined;
    let errorMessage: string | undefined;

    try {
      for await (const chunk of provider.streamChat({
        model: opts.model,
        messages: opts.messages,
        signal: opts.signal,
      })) {
        if (chunk.usage) usage = chunk.usage;
        if (chunk.delta) {
          output += chunk.delta;
          yield chunk.delta;
        }
      }
    } catch (err) {
      const aborted = err instanceof ProviderAbortError || Boolean(opts.signal?.aborted);
      status = aborted ? 'cancelled' : 'error';
      errorType = err instanceof Error ? err.name : 'UnknownError';
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      // Reached on success, thrown error, and caller-initiated early return.
      if (status === 'success' && opts.signal?.aborted) status = 'cancelled';
      try {
        this.#shipper.ship(
          buildInferenceLog({
            requestId,
            conversationId: opts.conversationId,
            messageId: opts.messageId,
            provider: opts.provider,
            model: opts.model,
            status,
            startedAt,
            completedAt: new Date(),
            usage,
            inputPreview,
            outputPreview: output,
            errorType,
            errorMessage,
          }),
        );
      } catch (shipErr) {
        // Telemetry must never surface to the caller.
        this.#logger.warn({ err: shipErr }, 'failed to enqueue inference log');
      }
    }

    return { requestId, status, usage, output };
  }
}
