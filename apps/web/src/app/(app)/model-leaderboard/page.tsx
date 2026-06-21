'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface LeaderboardEntry {
  provider: string;
  model: string;
  total: number;
  success: number;
  error: number;
  avgLatencyMs: number | null;
  lastUsedAt: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export default function ModelLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ data: LeaderboardEntry[] }>(`/api/v1/models/leaderboard?days=${days}`)
      .then((res) => setEntries(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model leaderboard"
        description="Compare model providers by usage, success rate, and latency."
      >
        <div className="flex items-center gap-2">
          <label htmlFor="days" className="text-xs text-[var(--text-secondary)]">
            Last
          </label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">Success</th>
              <th className="px-4 py-3 font-medium text-right">Error</th>
              <th className="px-4 py-3 font-medium text-right">Avg latency</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={`${entry.provider}:${entry.model}`}
                className="border-t border-[var(--border-subtle-solid)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    {entry.provider}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{entry.model}</td>
                <td className="px-4 py-3 text-right text-[var(--text-primary)]">{entry.total}</td>
                <td className="px-4 py-3 text-right text-[var(--accent-success)]">
                  {entry.success}
                </td>
                <td className="px-4 py-3 text-right text-[var(--text-danger)]">{entry.error}</td>
                <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                  {entry.avgLatencyMs !== null ? `${Math.round(entry.avgLatencyMs)} ms` : '—'}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No model invocations yet. Use the router to start collecting telemetry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
