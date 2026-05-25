'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Stat } from '@/components/ui';
import { getMetrics } from '@/lib/api';
import type { DashboardMetrics } from '@/lib/types';

const WINDOWS = [
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

/** A dependency-free bar chart. */
function Bars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-stone-400">No data yet</div>;
  }
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center justify-end">
          <div
            className={`w-full rounded-t ${color}`}
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            title={`${d.label}: ${d.value}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [windowHours, setWindowHours] = useState(24);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMetrics(await getMetrics(windowHours));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    }
  }, [windowHours]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000); // near real-time refresh
    return () => clearInterval(t);
  }, [load]);

  const s = metrics?.summary;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Inference Dashboard</h1>
          <p className="text-sm text-stone-500">Latency, throughput, errors & token usage</p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w.value}
              variant={w.value === windowHours ? 'primary' : 'ghost'}
              onClick={() => setWindowHours(w.value)}
            >
              {w.label}
            </Button>
          ))}
          <Link href="/">
            <Button variant="ghost">← Chat</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests" value={String(s?.totalRequests ?? 0)} />
        <Stat
          label="Error rate"
          value={`${((s?.errorRate ?? 0) * 100).toFixed(1)}%`}
          hint={`${s?.errorCount ?? 0} errors · ${s?.cancelledCount ?? 0} cancelled`}
        />
        <Stat label="Latency p50" value={`${s?.p50LatencyMs ?? 0} ms`} hint={`avg ${s?.avgLatencyMs ?? 0} ms`} />
        <Stat label="Latency p95" value={`${s?.p95LatencyMs ?? 0} ms`} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-2 text-sm font-medium text-stone-700">Throughput (requests/hr)</div>
          <Bars
            color="bg-olive-400"
            data={(metrics?.timeseries ?? []).map((t) => ({
              label: t.bucket.slice(11, 16),
              value: t.requests,
            }))}
          />
        </Card>
        <Card>
          <div className="mb-2 text-sm font-medium text-stone-700">Avg latency (ms/hr)</div>
          <Bars
            color="bg-sky-400"
            data={(metrics?.timeseries ?? []).map((t) => ({
              label: t.bucket.slice(11, 16),
              value: t.avgLatencyMs,
            }))}
          />
        </Card>
      </div>

      <Card className="mt-3">
        <div className="mb-2 text-sm font-medium text-stone-700">By provider / model</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-stone-400">
            <tr>
              <th className="py-1">Provider</th>
              <th>Model</th>
              <th className="text-right">Requests</th>
              <th className="text-right">Avg latency</th>
              <th className="text-right">Tokens</th>
              <th className="text-right">Error rate</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.byProvider ?? []).map((p) => (
              <tr key={`${p.provider}-${p.model}`} className="border-t border-stone-100">
                <td className="py-1.5">{p.provider}</td>
                <td>{p.model}</td>
                <td className="text-right">{p.requests}</td>
                <td className="text-right">{p.avgLatencyMs} ms</td>
                <td className="text-right">{p.totalTokens.toLocaleString()}</td>
                <td className="text-right">{(p.errorRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {(metrics?.byProvider ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-stone-400">
                  No inference logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-3">
        <div className="mb-2 text-sm font-medium text-stone-700">Recent inference logs</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-stone-400">
            <tr>
              <th className="py-1">Time</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Input preview (PII-redacted)</th>
              <th>Status</th>
              <th className="text-right">Latency</th>
              <th className="text-right">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.recent ?? []).map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="py-1.5 text-stone-500">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </td>
                <td>{r.provider}</td>
                <td>{r.model}</td>
                <td className="max-w-[28rem] truncate text-stone-600" title={r.inputPreview ?? ''}>
                  {r.inputPreview ?? '—'}
                </td>
                <td>
                  <Badge tone={r.status === 'success' ? 'success' : r.status === 'error' ? 'error' : 'cancelled'}>
                    {r.status}
                  </Badge>
                </td>
                <td className="text-right">{r.latencyMs} ms</td>
                <td className="text-right">{r.totalTokens ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
