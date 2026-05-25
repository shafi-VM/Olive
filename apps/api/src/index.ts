import { prisma } from '@olive/db';
import { config, logger } from './config.js';
import { logShipper } from './llm.js';
import { buildServer } from './server.js';

const app = buildServer();

async function start(): Promise<void> {
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(`API listening on :${config.API_PORT}`);
}

/** Graceful shutdown: stop accepting traffic, flush pending logs, close the DB. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down API');
  try {
    await app.close();
    await logShipper.close();
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
  } finally {
    process.exit(0);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}

start().catch((err) => {
  logger.error({ err }, 'failed to start API');
  process.exit(1);
});
