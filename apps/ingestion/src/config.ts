import { createLogger, getEnv } from '@olive/shared';

export const config = getEnv();
export const logger = createLogger('ingestion');

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

/** Preview length stored in the database after redaction. */
export const PREVIEW_LENGTH = 500;
/** BullMQ worker concurrency — how many logs are processed in parallel. */
export const WORKER_CONCURRENCY = 5;
