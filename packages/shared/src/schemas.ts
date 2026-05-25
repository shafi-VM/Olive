import { z } from 'zod';

/** Supported message roles in a conversation. */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** Lifecycle status of a conversation. */
export const conversationStatusSchema = z.enum(['active', 'cancelled', 'archived']);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

/** Outcome of a single inference call. */
export const inferenceStatusSchema = z.enum(['success', 'error', 'cancelled']);
export type InferenceStatus = z.infer<typeof inferenceStatusSchema>;

/**
 * The inference log payload — the contract between the SDK and the ingestion
 * service. Versioned (`schemaVersion`) so the ingestion side can evolve without
 * breaking older SDK clients.
 */
export const inferenceLogSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  status: inferenceStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  errorType: z.string().max(128).optional(),
  errorMessage: z.string().max(2000).optional(),
  inputPreview: z.string().max(4000).optional(),
  outputPreview: z.string().max(4000).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type InferenceLogPayload = z.infer<typeof inferenceLogSchema>;

/** Batch envelope accepted by the ingestion endpoint. */
export const ingestionRequestSchema = z.object({
  logs: z.array(inferenceLogSchema).min(1).max(100),
});
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;

/** A single chat message in an LLM request. */
export const chatMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Body for sending a new user message into a conversation. */
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(16000),
});
export type SendMessageBody = z.infer<typeof sendMessageSchema>;

/** Body for creating a conversation. Provider is a free string — the API
 * validates it against the live provider registry at chat time. */
export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  provider: z.string().min(1).max(32).optional(),
  model: z.string().min(1).max(128).optional(),
});
export type CreateConversationBody = z.infer<typeof createConversationSchema>;

/** Body for updating a conversation (cancel / archive / rename). */
export const updateConversationSchema = z.object({
  status: conversationStatusSchema.optional(),
  title: z.string().min(1).max(200).optional(),
});
export type UpdateConversationBody = z.infer<typeof updateConversationSchema>;
