import { ingestionRequestSchema } from '@olive/shared';
import type { FastifyInstance } from 'fastify';
import { ingestionQueue } from '../queue.js';

export async function logRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Inference-log intake. Validates the batch, enqueues each log onto BullMQ,
   * and returns 202 immediately — intake is decoupled from processing so a slow
   * database never backpressures the SDK. `jobId = requestId` deduplicates.
   */
  app.post('/v1/logs', async (req, reply) => {
    const { logs } = ingestionRequestSchema.parse(req.body);

    await ingestionQueue.addBulk(
      logs.map((log) => ({
        name: 'inference-log',
        data: log,
        opts: { jobId: log.requestId },
      })),
    );

    return reply.status(202).send({ accepted: logs.length });
  });
}
