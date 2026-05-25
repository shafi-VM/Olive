import { randomUUID } from 'node:crypto';
import { ingestionRequestSchema, inferenceLogSchema } from '@olive/shared';
import { describe, expect, it } from 'vitest';

function validLog() {
  const now = new Date().toISOString();
  return {
    requestId: randomUUID(),
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    status: 'success',
    latencyMs: 420,
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    inputPreview: 'hi',
    outputPreview: 'hello',
    startedAt: now,
    completedAt: now,
  };
}

describe('inferenceLogSchema', () => {
  it('accepts a well-formed log and defaults schemaVersion to 1', () => {
    const result = inferenceLogSchema.safeParse(validLog());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.schemaVersion).toBe(1);
  });

  it('rejects a non-uuid requestId', () => {
    expect(inferenceLogSchema.safeParse({ ...validLog(), requestId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown status', () => {
    expect(inferenceLogSchema.safeParse({ ...validLog(), status: 'weird' }).success).toBe(false);
  });

  it('rejects negative latency', () => {
    expect(inferenceLogSchema.safeParse({ ...validLog(), latencyMs: -5 }).success).toBe(false);
  });
});

describe('ingestionRequestSchema', () => {
  it('accepts a non-empty batch', () => {
    expect(ingestionRequestSchema.safeParse({ logs: [validLog()] }).success).toBe(true);
  });

  it('rejects an empty batch', () => {
    expect(ingestionRequestSchema.safeParse({ logs: [] }).success).toBe(false);
  });
});
