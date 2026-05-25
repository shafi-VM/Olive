# Architecture Notes

Companion to the [`README`](./README.md). Covers the ingestion flow, logging
strategy, scaling considerations, and failure-handling assumptions.

---

## 1. Ingestion flow

A single inference call produces exactly one log. End to end:

```
1. API receives POST /conversations/:id/messages
2. API persists the user message + an empty assistant placeholder (one tx)
3. API calls @olive/llm-sdk → OliveLLMClient.streamChat()
4. The SDK invokes the provider; tokens stream back to the browser over SSE
5. When the stream settles (success | error | cancel) the SDK builds ONE
   InferenceLogPayload — latency, tokens, status, timestamps, requestId,
   truncated input/output previews
6. The SDK's LogShipper buffers the payload and POSTs it (batched, ~1s flush)
   to the ingestion service:  POST /v1/logs
7. Ingestion validates the batch with Zod, then enqueues each log onto a
   BullMQ (Redis) queue, keyed by requestId. Responds 202 immediately.
8. A BullMQ worker consumes the queue:
     a. re-validates the payload (the queue is a trust boundary)
     b. redacts PII from previews (emails, phones, cards, SSNs)
     c. resolves nullable FKs (conversation / message may not exist)
     d. UPSERTs into inference_logs, keyed by requestId (idempotent)
9. GET /dashboard/metrics aggregates inference_logs into latency percentiles,
   throughput, error rates and token usage.
```

**Why an HTTP hop + a queue?** Two separable concerns:

- The **HTTP endpoint** is the SDK's only contract. The SDK ships logs over
  plain HTTP and stays infra-agnostic — it works in any app, with no Redis
  client. The ingestion service owns the queue.
- The **queue** decouples *intake* from *processing*. Intake is O(1) — validate
  and enqueue. A slow database, a redaction spike, or a worker restart never
  backpressures the SDK or the chat path. The worker drains at its own pace.

**Idempotency.** `requestId` is the BullMQ `jobId` *and* a unique column. A
duplicate submission collapses to one job; a retried job upserts the same row.
Exactly-once *effect* on an at-least-once delivery substrate.

---

## 2. Logging strategy

**Capture happens in the SDK, once, automatically.** `OliveLLMClient.streamChat`
wraps the provider call in a `try/catch/finally`. The `finally` guarantees a log
is emitted on every terminal state — normal completion, provider error, or
caller cancellation (even if the consumer stops iterating early). Callers write
zero telemetry code.

**What is captured:** provider, model, status, latency (ms), prompt/completion/
total tokens, start & end timestamps, a request id, a conversation/message id,
and truncated input/output previews. Token counts are provider-reported when
available, otherwise estimated and flagged (`metadata.tokensEstimated`).

**Fire-and-forget shipping.** `LogShipper.ship()` only enqueues into an in-memory
buffer and returns — it never awaits the network. A background timer flushes
batches every ~1s (near real time). The chat response and the telemetry path are
fully isolated: telemetry can never add latency to, or fail, a user request.

**Two log streams, by purpose:**
- *Operational* logs — Pino structured logs from each service (HTTP, errors,
  lifecycle). For humans/log shippers.
- *Inference* logs — the structured `inference_logs` rows. For analytics and the
  dashboard. This is the system's product.

**Redaction at the boundary.** The SDK sends previews untouched; the ingestion
**worker** redacts before persistence. PII therefore never lands in the
analytics DB, and redaction policy lives in one place (`@olive/shared/redaction`)
rather than being spread across every SDK caller.

---

## 3. Scaling considerations

| Component | Today | Scaling path |
|-----------|-------|--------------|
| API | Single process, stateless except the in-memory cancel registry | Horizontal replicas behind a load balancer; move cancellation to a Redis pub/sub channel |
| Ingestion API + worker | One process | Split into a stateless intake deployment and a separately-scaled worker pool; raise BullMQ `concurrency` / add worker replicas |
| Redis queue | Single instance | Redis Cluster / managed Redis; queue is the elastic buffer that absorbs spikes |
| `inference_logs` | Postgres table, indexed | Partition by `createdAt`; then move to a columnar store (ClickHouse / BigQuery) for high-cardinality analytics |
| Dashboard queries | `percentile_cont` at read time | Per-minute rollup tables / materialized views; serve the dashboard from rollups |
| LLM providers | Direct calls | Per-provider rate limiting, retries with backoff, circuit breakers |

The **queue is the pressure-release valve**: if logs arrive faster than they can
be written, they accumulate in Redis instead of being lost or slowing callers.
Scaling the write path = adding worker replicas.

The schema already separates **operational** data (conversations, messages) from
**analytical** data (`inference_logs`), so relocating analytics to its own store
is a localized change, not a rewrite.

---

## 4. Failure-handling assumptions

**Telemetry is best-effort relative to the user request.** This is the central
assumption — observability must never degrade chat.

| Failure | Behavior |
|---------|----------|
| Ingestion service down | SDK shipper retries the batch once, then drops it with a local Pino warning. **Chat is unaffected.** |
| Redis down | Ingestion `POST /v1/logs` fails; the SDK shipper treats it as above. `/ready` reports unhealthy. |
| Worker throws while processing a job | BullMQ retries with exponential backoff (4 attempts). |
| Job exhausts all retries | Moved to a **dead-letter queue** (`inference-logs-dlq`) — inspectable, never silently lost. |
| Duplicate / retried log | `requestId` upsert → idempotent, no duplicate rows. |
| Postgres down | Chat requests fail loudly (correct — chat needs the DB); the worker's failed jobs retry, then land in the DLQ. |
| Client disconnects mid-stream | API observes the socket close, aborts the `AbortController`; the SDK records the call as `cancelled` and persists partial output. |
| Provider error mid-stream | Surfaced to the user as an SSE `error` frame; the inference log is written with `status = error` and the error type/message. |
| LLM call cancelled | `AbortSignal` propagates SDK → provider; the log is written with `status = cancelled`. |

**Graceful shutdown.** On `SIGTERM`/`SIGINT` both services stop accepting work,
the API flushes the SDK's pending log buffer, the worker finishes in-flight jobs,
and DB/Redis connections close cleanly — minimizing telemetry loss on deploys.

**Trust boundaries.** Payloads are validated with Zod twice — at the HTTP
intake *and* again in the worker before persistence — because the Redis queue
sits between them and is treated as untrusted.
