import { Prisma, prisma } from '@olive/db';

export interface MetricsSummary {
  totalRequests: number;
  errorCount: number;
  cancelledCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
}

export interface TimeBucket {
  bucket: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
}

export interface ProviderBreakdown {
  provider: string;
  model: string;
  requests: number;
  avgLatencyMs: number;
  totalTokens: number;
  errorRate: number;
}

export interface RecentLog {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  status: string;
  latencyMs: number;
  totalTokens: number | null;
  errorType: string | null;
  inputPreview: string | null;
  createdAt: Date;
}

export interface DashboardMetrics {
  windowHours: number;
  summary: MetricsSummary;
  timeseries: TimeBucket[];
  byProvider: ProviderBreakdown[];
  recent: RecentLog[];
}

/**
 * Computes dashboard analytics over a trailing time window.
 *
 * Percentiles use Postgres `percentile_cont` (raw SQL) — the database is the
 * right place to aggregate, avoiding pulling every row into the API process.
 * At larger scale these would be served from a pre-aggregated rollup table
 * (noted in the README under scaling).
 */
export async function getDashboardMetrics(windowHours: number): Promise<DashboardMetrics> {
  const hours = Math.min(Math.max(windowHours, 1), 720);
  // Compute the cutoff in JS and bind it as a timestamp — portable and avoids
  // database-specific interval arithmetic.
  const since = new Date(Date.now() - hours * 3600_000);

  const [summaryRows, timeseries, byProvider, recent] = await Promise.all([
    prisma.$queryRaw<
      {
        total: number;
        errors: number;
        cancelled: number;
        avg_latency: number;
        p50: number;
        p95: number;
        total_tokens: number;
      }[]
    >(Prisma.sql`
      SELECT
        count(*)::int                                                          AS total,
        count(*) FILTER (WHERE status = 'error')::int                          AS errors,
        count(*) FILTER (WHERE status = 'cancelled')::int                      AS cancelled,
        coalesce(avg("latencyMs"), 0)::float                                   AS avg_latency,
        coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY "latencyMs"), 0)::float  AS p50,
        coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs"), 0)::float AS p95,
        coalesce(sum("totalTokens"), 0)::float                                 AS total_tokens
      FROM inference_logs
      WHERE "createdAt" >= ${since}
    `),

    prisma.$queryRaw<
      { bucket: Date; requests: number; errors: number; avg_latency: number }[]
    >(Prisma.sql`
      SELECT
        date_trunc('hour', "createdAt")               AS bucket,
        count(*)::int                                 AS requests,
        count(*) FILTER (WHERE status = 'error')::int AS errors,
        coalesce(avg("latencyMs"), 0)::float          AS avg_latency
      FROM inference_logs
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `),

    prisma.$queryRaw<
      {
        provider: string;
        model: string;
        requests: number;
        avg_latency: number;
        total_tokens: number;
        errors: number;
      }[]
    >(Prisma.sql`
      SELECT
        provider,
        model,
        count(*)::int                                 AS requests,
        coalesce(avg("latencyMs"), 0)::float          AS avg_latency,
        coalesce(sum("totalTokens"), 0)::float        AS total_tokens,
        count(*) FILTER (WHERE status = 'error')::int AS errors
      FROM inference_logs
      WHERE "createdAt" >= ${since}
      GROUP BY provider, model
      ORDER BY requests DESC
    `),

    prisma.inferenceLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        requestId: true,
        provider: true,
        model: true,
        status: true,
        latencyMs: true,
        totalTokens: true,
        errorType: true,
        inputPreview: true,
        createdAt: true,
      },
    }),
  ]);

  const s = summaryRows[0] ?? {
    total: 0,
    errors: 0,
    cancelled: 0,
    avg_latency: 0,
    p50: 0,
    p95: 0,
    total_tokens: 0,
  };

  return {
    windowHours: hours,
    summary: {
      totalRequests: s.total,
      errorCount: s.errors,
      cancelledCount: s.cancelled,
      errorRate: s.total > 0 ? s.errors / s.total : 0,
      avgLatencyMs: Math.round(s.avg_latency),
      p50LatencyMs: Math.round(s.p50),
      p95LatencyMs: Math.round(s.p95),
      totalTokens: Math.round(s.total_tokens),
    },
    timeseries: timeseries.map((t) => ({
      bucket: t.bucket.toISOString(),
      requests: t.requests,
      errors: t.errors,
      avgLatencyMs: Math.round(t.avg_latency),
    })),
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      model: p.model,
      requests: p.requests,
      avgLatencyMs: Math.round(p.avg_latency),
      totalTokens: Math.round(p.total_tokens),
      errorRate: p.requests > 0 ? p.errors / p.requests : 0,
    })),
    recent,
  };
}
