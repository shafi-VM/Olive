import { QUEUE } from '@olive/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';

/** Shared Redis connection. `maxRetriesPerRequest: null` is required by BullMQ. */
export const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Primary ingestion queue. Jobs retry with exponential backoff; `jobId` is set
 * to the log's `requestId` so duplicate submissions collapse to one job.
 */
export const ingestionQueue = new Queue(QUEUE.INGESTION, {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/** Dead-letter queue: jobs that exhausted all retries land here for inspection. */
export const deadLetterQueue = new Queue(QUEUE.DEAD_LETTER, { connection });
