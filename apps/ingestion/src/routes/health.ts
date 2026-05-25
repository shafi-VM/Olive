import type { FastifyInstance } from 'fastify';
import { connection } from '../queue.js';

/** Liveness + readiness. Readiness pings Redis so traffic is gated on the queue. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', service: 'ingestion' }));

  app.get('/ready', async (_req, reply) => {
    try {
      await connection.ping();
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'unavailable', reason: 'redis' });
    }
  });
}
