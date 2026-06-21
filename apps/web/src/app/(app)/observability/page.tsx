'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Activity, BarChart3, Globe } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface MetricRow {
  name: string;
  labels: Record<string, string>;
  value: number;
}

function parsePrometheus(text: string): MetricRow[] {
  const rows: MetricRow[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(.+)$/);
    if (!match) continue;
    const name = match[1];
    const labels: Record<string, string> = {};
    if (match[2]) {
      const inner = match[2].slice(1, -1);
      for (const part of inner.split(',')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const key = part.slice(0, eq).trim();
        const value = part
          .slice(eq + 1)
          .trim()
          .replace(/^"|"$/g, '');
        labels[key] = value;
      }
    }
    const value = Number(match[3]);
    if (!Number.isNaN(value)) {
      rows.push({ name, labels, value });
    }
  }
  return rows;
}

export default function ObservabilityPage() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/metrics', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.text();
      })
      .then((text) => setRows(parsePrometheus(text)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const httpTotal = useMemo(
    () => rows.filter((r) => r.name === 'mimir_http_requests_total'),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return httpTotal;
    return httpTotal.filter(
      (r) =>
        r.labels.method?.toLowerCase().includes(q) ||
        r.labels.path?.toLowerCase().includes(q) ||
        r.labels.status?.toLowerCase().includes(q)
    );
  }, [httpTotal, filter]);

  const totalRequests = useMemo(() => httpTotal.reduce((sum, r) => sum + r.value, 0), [httpTotal]);
  const errorRequests = useMemo(
    () =>
      httpTotal
        .filter((r) => r.labels.status?.startsWith('5'))
        .reduce((sum, r) => sum + r.value, 0),
    [httpTotal]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observability"
        description="Live metrics and request telemetry from the Mimir API."
      />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">HTTP requests</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{totalRequests}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium">Unique routes</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {httpTotal.length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">5xx errors</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{errorRequests}</p>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by method, path, or status"
          className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-80"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Path</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.labels.method}-${r.labels.path}-${r.labels.status}-${i}`}
                className="border-t border-[var(--border-subtle-solid)]"
              >
                <td className="px-4 py-3 text-[var(--text-primary)]">{r.labels.method}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{r.labels.path}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{r.labels.status}</td>
                <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">
                  {r.value}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No HTTP request metrics available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
