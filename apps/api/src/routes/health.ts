import { prisma } from '@olive/db';
import type { FastifyInstance } from 'fastify';

/** Liveness + readiness. Readiness pings Postgres so orchestrators can gate traffic. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', service: 'api' }));

  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'unavailable', reason: 'database' });
    }
  });
}
