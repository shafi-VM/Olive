import { prisma } from '@olive/db';
import { type InferenceLogPayload, redactPII, truncate } from '@olive/shared';
import { PREVIEW_LENGTH } from './config.js';

/**
 * Resolves an optional foreign key, returning null if the referenced row does
 * not exist. Logs may legitimately arrive before/without their conversation or
 * message (the SDK is decoupled from chat persistence), and the schema's
 * nullable FKs let us keep the log regardless.
 */
async function resolveConversationId(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveMessageId(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.message.findUnique({ where: { id }, select: { id: true } });
  return found?.id ?? null;
}

/**
 * Processes one inference log: redacts PII from previews, extracts redaction
 * metadata, and upserts into `inference_logs` keyed by `requestId`. The upsert
 * makes the worker idempotent — a retried job produces the same row.
 */
export async function persistInferenceLog(payload: InferenceLogPayload): Promise<void> {
  const input = redactPII(payload.inputPreview);
  const output = redactPII(payload.outputPreview);

  const [conversationId, messageId] = await Promise.all([
    resolveConversationId(payload.conversationId),
    resolveMessageId(payload.messageId),
  ]);

  // Extracted metadata: caller-supplied bag + a redaction summary.
  const metadata = {
    ...(payload.metadata ?? {}),
    schemaVersion: payload.schemaVersion,
    redaction: {
      redacted: input.redacted || output.redacted,
      input: input.counts,
      output: output.counts,
    },
  };

  const data = {
    conversationId,
    messageId,
    provider: payload.provider,
    model: payload.model,
    status: payload.status,
    latencyMs: payload.latencyMs,
    promptTokens: payload.promptTokens ?? null,
    completionTokens: payload.completionTokens ?? null,
    totalTokens: payload.totalTokens ?? null,
    errorType: payload.errorType ?? null,
    errorMessage: payload.errorMessage ?? null,
    inputPreview: truncate(input.text, PREVIEW_LENGTH),
    outputPreview: truncate(output.text, PREVIEW_LENGTH),
    startedAt: new Date(payload.startedAt),
    completedAt: new Date(payload.completedAt),
    metadata,
  };

  await prisma.inferenceLog.upsert({
    where: { requestId: payload.requestId },
    create: { requestId: payload.requestId, ...data },
    update: data,
  });
}
