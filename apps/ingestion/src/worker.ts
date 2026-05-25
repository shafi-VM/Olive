import { type InferenceLogPayload, QUEUE, inferenceLogSchema } from '@olive/shared';
import { type Job, Worker } from 'bullmq';
import { WORKER_CONCURRENCY, logger } from './config.js';
import { persistInferenceLog } from './processor.js';
import { connection, deadLetterQueue } from './queue.js';

/**
 * BullMQ worker that drains the ingestion queue. Payloads are re-validated
 * defensively (the queue is a trust boundary) before persistence.
 */
export function startWorker(): Worker {
  const worker = new Worker<InferenceLogPayload>(
    QUEUE.INGESTION,
    async (job: Job<InferenceLogPayload>) => {
      const payload = inferenceLogSchema.parse(job.data);
      await persistInferenceLog(payload);
    },
    { connection, concurrency: WORKER_CONCURRENCY },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'inference log persisted');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.warn(
      { jobId: job.id, attempt: job.attemptsMade, exhausted, err: err.message },
      'ingestion job failed',
    );
    if (exhausted) {
      // Move to the DLQ so no telemetry is silently lost.
      await deadLetterQueue.add('dead-letter', {
        payload: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      });
    }
  });

  logger.info({ concurrency: WORKER_CONCURRENCY }, 'ingestion worker started');
  return worker;
}
