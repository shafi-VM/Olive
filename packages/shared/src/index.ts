export { getEnv, type Env } from './env.js';
export { createLogger, type Logger } from './logger.js';
export { redactPII, truncate, type RedactionResult } from './redaction.js';
export * from './schemas.js';

/** SSE event names shared between the API stream and the frontend client. */
export const SSE_EVENT = {
  TOKEN: 'token',
  DONE: 'done',
  ERROR: 'error',
} as const;

/** Stable BullMQ queue + job names. */
export const QUEUE = {
  INGESTION: 'inference-logs',
  DEAD_LETTER: 'inference-logs-dlq',
} as const;
