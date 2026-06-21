'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { ThumbsDown, ThumbsUp, UserCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Reputation {
  id: string;
  role: string;
  score: number;
  successCount: number;
  failureCount: number;
  lastUpdatedAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export default function AgentReputationPage() {
  const [rows, setRows] = useState<Reputation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ data: Reputation[] }>('/api/v1/agents/reputation')
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function sendFeedback(role: string, outcome: 'success' | 'failure') {
    fetchJson<Reputation>(`/api/v1/agents/reputation/${role}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
      .then(() => load())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent reputation"
        description="Track how often each agent role succeeds and flag failures."
      />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)]">
                <UserCircle className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold capitalize text-[var(--text-primary)]">
                  {row.role}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Score {row.score} · {row.successCount} success · {row.failureCount} failure
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sendFeedback(row.role, 'success')}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-success)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--accent-success)] transition-colors hover:bg-[var(--accent-success)]/20"
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Success
              </button>
              <button
                type="button"
                onClick={() => sendFeedback(row.role, 'failure')}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--text-danger)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--text-danger)] transition-colors hover:bg-[var(--text-danger)]/20"
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Failure
              </button>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No reputation data yet. Give feedback as agents run tasks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
