'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { RemediationRun } from '@mimir/shared-types';
import { Activity, CheckCircle, Loader2, Play, ShieldAlert, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function statusIcon(status: RemediationRun['status']) {
  switch (status) {
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'failed':
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Activity className="h-4 w-4 text-amber-500" />;
    default:
      return <Wrench className="h-4 w-4 text-slate-500" />;
  }
}

export default function RemediationPage() {
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [issue, setIssue] = useState('');
  const [runs, setRuns] = useState<RemediationRun[]>([]);
  const [activeRun, setActiveRun] = useState<RemediationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    try {
      const res = await fetchJson<{ data: RemediationRun[] }>('/api/v1/remediations');
      setRuns(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ data: RemediationRun }>('/api/v1/remediations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, issue }),
      });
      setActiveRun(res.data);
      setTargetType('');
      setTargetId('');
      setIssue('');
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(run: RemediationRun) {
    setError(null);
    try {
      const res = await fetchJson<{ data: RemediationRun }>(
        `/api/v1/remediations/${run.id}/resolve`,
        {
          method: 'POST',
        }
      );
      setActiveRun(res.data);
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Self-healing"
        description="Detect issues, generate remediation plans, and track resolution runs across your nodes and services."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
            data-testid="remediation-form"
          >
            <label
              htmlFor="remediation-target-type"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Target type
            </label>
            <input
              id="remediation-target-type"
              type="text"
              value={targetType}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetType(e.target.value)}
              placeholder="e.g. node, service, workflow"
              data-testid="remediation-target-type"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)]"
            />

            <label
              htmlFor="remediation-target-id"
              className="mt-3 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Target id
            </label>
            <input
              id="remediation-target-id"
              type="text"
              value={targetId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetId(e.target.value)}
              placeholder="e.g. laptop-alpha"
              data-testid="remediation-target-id"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)]"
            />

            <label
              htmlFor="remediation-issue"
              className="mt-3 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Issue
            </label>
            <textarea
              id="remediation-issue"
              value={issue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIssue(e.target.value)}
              placeholder="Describe the symptom or failure."
              rows={4}
              data-testid="remediation-issue"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)]"
            />

            <button
              type="submit"
              disabled={loading || !targetType.trim() || !targetId.trim() || !issue.trim()}
              data-testid="remediation-run"
              className={cn(
                'mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Run remediation
            </button>
          </form>

          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Recent runs</h4>
            {runs.length === 0 && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">No remediation runs yet.</p>
            )}
            <ul className="mt-2 space-y-2" data-testid="remediation-run-list">
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setActiveRun(run)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle-solid)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--accent-primary)]',
                      activeRun?.id === run.id &&
                        'border-[var(--accent-primary)] bg-[var(--bg-surface-raised)]'
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {statusIcon(run.status)}
                      <span className="truncate">
                        {run.targetType}: {run.targetId}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px]',
                        run.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : run.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      )}
                      data-testid="remediation-run-status"
                    >
                      {run.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {activeRun ? (
            <>
              <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {activeRun.targetType}: {activeRun.targetId}
                  </h3>
                  <div className="flex items-center gap-2">
                    {statusIcon(activeRun.status)}
                    <span
                      data-testid="remediation-detail-status"
                      className="text-xs text-[var(--text-muted)]"
                    >
                      {activeRun.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{activeRun.issue}</p>
                {activeRun.status !== 'resolved' && activeRun.status !== 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleResolve(activeRun)}
                    data-testid="remediation-resolve"
                    className={cn(
                      'mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                      'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                    )}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Mark resolved
                  </button>
                )}
              </div>

              <div className="flex-1 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Recommended action
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">AI generated</span>
                </div>
                <div
                  data-testid="remediation-action"
                  className="rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]"
                >
                  {activeRun.action ?? 'No action generated yet.'}
                </div>

                {Object.keys(activeRun.output).length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Output</span>
                    <pre
                      data-testid="remediation-output"
                      className="mt-2 h-48 w-full overflow-auto rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 font-mono text-xs leading-relaxed"
                    >
                      {JSON.stringify(activeRun.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-[var(--bg-surface)] p-8 text-sm text-[var(--text-muted)] shadow-card">
              <div className="text-center">
                <Wrench className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                <p>Run a remediation to see the generated action here.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
