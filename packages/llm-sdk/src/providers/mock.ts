import { estimateTokens } from '../tokens.js';
import { type LLMProvider, ProviderAbortError, type ProviderRequest, type StreamChunk } from '../types.js';

const FILLER =
  'This is a simulated streaming response from the Olive mock provider, useful for running the full system end-to-end without any API keys.';

/**
 * Zero-dependency provider that streams a canned response token by token.
 * Lets the entire pipeline (streaming, telemetry, ingestion, dashboard) be
 * demoed and tested with no external credentials.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  async *streamChat(req: ProviderRequest): AsyncIterable<StreamChunk> {
    const prompt = req.messages.map((m) => m.content).join('\n');
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const reply = `You said: "${(lastUser?.content ?? '').slice(0, 120)}". ${FILLER}`;
    const words = reply.split(' ');

    let output = '';
    for (let i = 0; i < words.length; i += 1) {
      if (req.signal?.aborted) throw new ProviderAbortError();
      await new Promise((resolve) => setTimeout(resolve, 35));
      const piece = (i === 0 ? '' : ' ') + words[i];
      output += piece;
      yield { delta: piece, done: false };
    }

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(output);
    yield {
      delta: '',
      done: true,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimated: true,
      },
    };
  }
}
