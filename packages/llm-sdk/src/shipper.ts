import { type InferenceLogPayload, type Logger } from '@olive/shared';

export interface ShipperOptions {
  /** Base URL of the ingestion service, e.g. http://localhost:4001 */
  ingestionUrl: string;
  logger: Logger;
  /** Max logs per HTTP batch. Default 20. */
  maxBatch?: number;
  /** Flush cadence in ms. Default 1000 (near real-time). */
  flushIntervalMs?: number;
}

/**
 * Buffered, fire-and-forget log shipper.
 *
 * Telemetry must never slow down or break a chat response, so `ship()` only
 * enqueues — it never awaits the network. Logs are flushed in small batches on
 * a short interval (near real-time) and on a one-shot retry. If ingestion is
 * unreachable the batch is dropped after the retry and the failure is logged
 * locally; the chat path is unaffected. This is the core failure-handling
 * assumption: observability is best-effort relative to the user request.
 */
export class LogShipper {
  readonly #url: string;
  readonly #logger: Logger;
  readonly #maxBatch: number;
  readonly #flushIntervalMs: number;
  #buffer: InferenceLogPayload[] = [];
  #timer: NodeJS.Timeout | undefined;
  #closed = false;

  constructor(opts: ShipperOptions) {
    this.#url = `${opts.ingestionUrl.replace(/\/$/, '')}/v1/logs`;
    this.#logger = opts.logger;
    this.#maxBatch = opts.maxBatch ?? 20;
    this.#flushIntervalMs = opts.flushIntervalMs ?? 1000;
  }

  /** Enqueues a log. Non-blocking. */
  ship(payload: InferenceLogPayload): void {
    if (this.#closed) return;
    this.#buffer.push(payload);
    if (this.#buffer.length >= this.#maxBatch) {
      void this.#flush();
    } else if (!this.#timer) {
      this.#timer = setTimeout(() => void this.#flush(), this.#flushIntervalMs);
    }
  }

  async #flush(): Promise<void> {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    if (this.#buffer.length === 0) return;

    const batch = this.#buffer;
    this.#buffer = [];

    const ok = await this.#post(batch);
    if (!ok) {
      // One retry, then give up to protect memory.
      const retried = await this.#post(batch);
      if (!retried) {
        this.#logger.warn({ dropped: batch.length }, 'log shipper: dropped batch after retry');
      }
    }
  }

  async #post(batch: InferenceLogPayload[]): Promise<boolean> {
    try {
      const res = await fetch(this.#url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logs: batch }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.#logger.warn({ status: res.status }, 'log shipper: ingestion rejected batch');
        return false;
      }
      this.#logger.debug({ shipped: batch.length }, 'log shipper: batch delivered');
      return true;
    } catch (err) {
      this.#logger.warn({ err }, 'log shipper: ingestion unreachable');
      return false;
    }
  }

  /** Flushes remaining logs and stops the timer. Call on graceful shutdown. */
  async close(): Promise<void> {
    this.#closed = true;
    await this.#flush();
  }
}
