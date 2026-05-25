import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { fastifyLoggerOptions } from './config.js';
import { healthRoutes } from './routes/health.js';
import { logRoutes } from './routes/logs.js';

/** Builds the ingestion Fastify instance. */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: fastifyLoggerOptions });

  app.register(cors, { origin: true });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'Invalid log payload',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(err.statusCode ?? 500).send({ error: err.message || 'Internal error' });
  });

  app.register(healthRoutes);
  app.register(logRoutes);

  return app;
}
