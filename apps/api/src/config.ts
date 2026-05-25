import { createLogger, getEnv } from '@olive/shared';

export const config = getEnv();

/** Logger for service-level (non-HTTP) logging. */
export const logger = createLogger('api');

/** Pino options Fastify uses to build its own (fully-typed) HTTP logger. */
export const fastifyLoggerOptions =
  config.NODE_ENV === 'production'
    ? { level: 'info' }
    : {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      };

/** Number of most-recent messages sent to the model as conversational context. */
export const CONTEXT_WINDOW = 20;

/** System prompt prepended to every conversation. */
export const SYSTEM_PROMPT =
  'You are Olive, a concise and helpful AI assistant. Answer clearly and directly.';
