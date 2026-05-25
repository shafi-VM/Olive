import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { fastifyLoggerOptions } from './config.js';
import { conversationRoutes } from './routes/conversations.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { healthRoutes } from './routes/health.js';

/** Builds the Fastify instance with CORS, error handling, and routes. */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: fastifyLoggerOptions });

  app.register(cors, { origin: true });

  // Zod validation failures become clean 400s; everything else is a 500.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation failed',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(err.statusCode ?? 500).send({ error: err.message || 'Internal error' });
  });

  app.register(healthRoutes);
  app.register(conversationRoutes);
  app.register(dashboardRoutes);

  return app;
}
