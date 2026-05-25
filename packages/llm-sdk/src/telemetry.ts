import { type InferenceLogPayload, type InferenceStatus, truncate } from '@olive/shared';
import type { TokenUsage } from './types.js';

export interface BuildLogInput {
  requestId: string;
  conversationId?: string;
  messageId?: string;
  provider: string;
  model: string;
  status: InferenceStatus;
  startedAt: Date;
  completedAt: Date;
  usage?: TokenUsage;
  inputPreview: string;
  outputPreview: string;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Assembles a schema-valid inference log from a completed call. Previews are
 * truncated here; PII redaction happens downstream in the ingestion worker so
 * the SDK stays free of redaction policy.
 */
export function buildInferenceLog(input: BuildLogInput): InferenceLogPayload {
  return {
    schemaVersion: 1,
    requestId: input.requestId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    provider: input.provider,
    model: input.model,
    status: input.status,
    latencyMs: Math.max(0, input.completedAt.getTime() - input.startedAt.getTime()),
    promptTokens: input.usage?.promptTokens,
    completionTokens: input.usage?.completionTokens,
    totalTokens: input.usage?.totalTokens,
    errorType: input.errorType,
    errorMessage: input.errorMessage ? truncate(input.errorMessage, 2000) : undefined,
    inputPreview: truncate(input.inputPreview, 2000),
    outputPreview: truncate(input.outputPreview, 2000),
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    metadata: {
      tokensEstimated: input.usage?.estimated ?? true,
    },
  };
}
