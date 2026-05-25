import pino, { type Logger } from 'pino';

/**
 * Creates a structured Pino logger scoped to a service. Pretty-prints in
 * development for readability; emits raw JSON in production for log shippers.
 */
export function createLogger(service: string): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    base: { service },
    transport: isDev
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  });
}

export type { Logger };
