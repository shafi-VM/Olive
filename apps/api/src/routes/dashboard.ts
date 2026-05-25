import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDashboardMetrics } from '../services/metrics.service.js';

const querySchema = z.object({
  windowHours: z.coerce.number().int().positive().max(720).default(24),
});

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  /** Aggregated latency / throughput / error / token metrics for the dashboard. */
  app.get('/dashboard/metrics', async (req) => {
    const { windowHours } = querySchema.parse(req.query);
    return getDashboardMetrics(windowHours);
  });
}
