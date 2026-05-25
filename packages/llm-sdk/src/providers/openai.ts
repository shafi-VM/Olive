import OpenAI from 'openai';
import { estimateTokens } from '../tokens.js';
import { type LLMProvider, ProviderAbortError, type ProviderRequest, type StreamChunk, type TokenUsage } from '../types.js';

export interface OpenAIProviderOptions {
  /** Override the provider name (e.g. "openrouter"). */
  name?: string;
  /** Override the API base URL — any OpenAI-compatible gateway works here. */
  baseURL?: string;
  /** Extra headers (OpenRouter uses `HTTP-Referer` / `X-Title`). */
  defaultHeaders?: Record<string, string>;
}

/**
 * OpenAI-compatible provider. Talks the OpenAI Chat Completions API, so it also
 * drives any compatible gateway (OpenRouter, Together, local vLLM, …) simply by
 * pointing `baseURL` elsewhere — the SDK abstraction made this a 3-line change.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  readonly #client: OpenAI;

  constructor(apiKey: string, opts: OpenAIProviderOptions = {}) {
    if (!apiKey) throw new Error('OpenAIProvider requires an API key');
    this.name = opts.name ?? 'openai';
    this.#client = new OpenAI({
      apiKey,
      baseURL: opts.baseURL,
      defaultHeaders: opts.defaultHeaders,
    });
  }

  async *streamChat(req: ProviderRequest): AsyncIterable<StreamChunk> {
    const stream = await this.#client.chat.completions.create(
      {
        model: req.model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: req.signal },
    );

    let usage: TokenUsage | undefined;
    let output = '';

    for await (const chunk of stream) {
      if (req.signal?.aborted) throw new ProviderAbortError();

      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
          estimated: false,
        };
      }

      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        output += text;
        yield { delta: text, done: false };
      }
    }

    yield {
      delta: '',
      done: true,
      usage: usage ?? {
        promptTokens: 0,
        completionTokens: estimateTokens(output),
        totalTokens: estimateTokens(output),
        estimated: true,
      },
    };
  }
}
