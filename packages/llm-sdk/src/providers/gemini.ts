import { GoogleGenAI } from '@google/genai';
import { estimateTokens } from '../tokens.js';
import { type LLMProvider, ProviderAbortError, type ProviderRequest, type StreamChunk, type TokenUsage } from '../types.js';

/**
 * Google Gemini provider built on `@google/genai`. System messages are mapped
 * to `systemInstruction`; assistant turns map to Gemini's `model` role.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly #ai: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('GeminiProvider requires GEMINI_API_KEY');
    this.#ai = new GoogleGenAI({ apiKey });
  }

  async *streamChat(req: ProviderRequest): AsyncIterable<StreamChunk> {
    const systemInstruction = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const stream = await this.#ai.models.generateContentStream({
      model: req.model,
      contents,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });

    let usage: TokenUsage | undefined;
    let output = '';

    for await (const chunk of stream) {
      if (req.signal?.aborted) throw new ProviderAbortError();

      const meta = chunk.usageMetadata;
      if (meta) {
        usage = {
          promptTokens: meta.promptTokenCount ?? 0,
          completionTokens: meta.candidatesTokenCount ?? 0,
          totalTokens: meta.totalTokenCount ?? 0,
          estimated: false,
        };
      }

      const text = chunk.text ?? '';
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
