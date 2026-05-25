import type { InferenceLogPayload, Logger } from '@olive/shared';
import { describe, expect, it } from 'vitest';
import { OliveLLMClient } from './client.js';
import { MockProvider } from './providers/mock.js';
import type { LogShipper } from './shipper.js';

const noopLogger = {
  warn: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined,
} as unknown as Logger;

/** Test double that captures shipped logs instead of sending them. */
function captureShipper() {
  const shipped: InferenceLogPayload[] = [];
  const shipper = { ship: (p: InferenceLogPayload) => shipped.push(p) } as unknown as LogShipper;
  return { shipper, shipped };
}

describe('MockProvider', () => {
  it('streams text deltas then a terminal chunk with usage', async () => {
    const chunks = [];
    for await (const c of new MockProvider().streamChat({
      model: 'mock-1',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(c);
    }
    const text = chunks
      .filter((c) => !c.done)
      .map((c) => c.delta)
      .join('');
    expect(text.length).toBeGreaterThan(0);

    const last = chunks.at(-1);
    expect(last?.done).toBe(true);
    expect(last?.usage?.totalTokens).toBeGreaterThan(0);
  });

  it('aborts when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      (async () => {
        for await (const _ of new MockProvider().streamChat({
          model: 'mock-1',
          messages: [{ role: 'user', content: 'hi' }],
          signal: ac.signal,
        })) {
          void _;
        }
      })(),
    ).rejects.toThrow();
  });
});

describe('OliveLLMClient telemetry', () => {
  it('emits exactly one inference log per successful call', async () => {
    const { shipper, shipped } = captureShipper();
    const client = new OliveLLMClient({
      providers: { mock: new MockProvider() },
      shipper,
      logger: noopLogger,
    });

    const gen = client.streamChat({
      provider: 'mock',
      model: 'mock-1',
      messages: [{ role: 'user', content: 'hello there' }],
    });
    let next = await gen.next();
    while (!next.done) next = await gen.next();

    expect(shipped).toHaveLength(1);
    expect(shipped[0]?.status).toBe('success');
    expect(shipped[0]?.provider).toBe('mock');
    expect(shipped[0]?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(next.value.output.length).toBeGreaterThan(0);
  });

  it('records a cancelled status when the caller aborts', async () => {
    const { shipper, shipped } = captureShipper();
    const client = new OliveLLMClient({
      providers: { mock: new MockProvider() },
      shipper,
      logger: noopLogger,
    });
    const ac = new AbortController();
    ac.abort();

    await expect(
      (async () => {
        const gen = client.streamChat({
          provider: 'mock',
          model: 'mock-1',
          messages: [{ role: 'user', content: 'hi' }],
          signal: ac.signal,
        });
        let next = await gen.next();
        while (!next.done) next = await gen.next();
      })(),
    ).rejects.toThrow();

    expect(shipped).toHaveLength(1);
    expect(shipped[0]?.status).toBe('cancelled');
  });
});
