import { PrismaClient } from './generated/client/index.js';

/**
 * Process-wide Prisma singleton. Cached on `globalThis` in non-production so
 * dev hot-reload does not exhaust the Postgres connection pool.
 */
const globalForPrisma = globalThis as unknown as { __olivePrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__olivePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__olivePrisma = prisma;
}

export * from './generated/client/index.js';
