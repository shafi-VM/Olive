import { prisma } from '@olive/db';
import { config, logger } from './config.js';
import { connection, deadLetterQueue, ingestionQueue } from './queue.js';
import { buildServer } from './server.js';
import { startWorker } from './worker.js';

/**
 * The ingestion service runs the HTTP intake API and the BullMQ worker in one
 * process — simplest to operate for this scope. At scale they would be split
 * into separately-scaled deployments (noted in the README).
 */
const app = buildServer();
const worker = startWorker();

async function start(): Promise<void> {
  await app.listen({ port: config.INGESTION_PORT, host: '0.0.0.0' });
  logger.info(`Ingestion listening on :${config.INGESTION_PORT}`);
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down ingestion');
  try {
    await app.close();
    await worker.close();
    await ingestionQueue.close();
    await deadLetterQueue.close();
    connection.disconnect();
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
  logger.error({ err }, 'failed to start ingestion');
  process.exit(1);
});
