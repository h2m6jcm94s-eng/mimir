'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Node, Routine } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Server,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type TriggerType = 'scheduled' | 'manual';
type RoutineStatus = 'enabled' | 'disabled';

type RoutineView = Routine & {
  trigger: TriggerType;
  status: RoutineStatus;
};

const filters: Array<TriggerType | 'All'> = ['All', 'scheduled', 'manual'];

const triggerIcon: Record<TriggerType, React.ElementType> = {
  scheduled: Clock,
  manual: Calendar,
};

const triggerLabel: Record<TriggerType, string> = {
  scheduled: 'Scheduled',
  manual: 'Manual',
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.headers ?? {}),
      ...(options?.body && { 'content-type': 'application/json' }),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(date?: string): string {
  if (!date) return 'Never';
  const then = new Date(date).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(date).toLocaleString();
}

function routineStatus(r: Routine): RoutineStatus {
  return r.enabled ? 'enabled' : 'disabled';
}

function routineTrigger(r: Routine): TriggerType {
  // For now every routine is cron-based (scheduled) or manual if no cron.
  return r.cron ? 'scheduled' : 'manual';
}

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TriggerType | 'All'>('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    name: '',
    description: '',
    cron: '0 8 * * *',
    jobType: 'capture',
    jobInput: '{}',
    tier: 0,
    enabled: true,
    nodeId: '',
  });
  const [nodes, setNodes] = useState<Node[]>([]);

  async function loadRoutines() {
    try {
      setLoading(true);
      setError(null);
      const body = await fetchJson<{ data: Routine[] }>('/api/v1/routines');
      setRoutines(
        body.data.map((r) => ({
          ...r,
          trigger: routineTrigger(r),
          status: routineStatus(r),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  }

  async function loadNodes() {
    try {
      const body = await fetchJson<{ data: Node[] }>('/api/v1/nodes');
      setNodes(body.data);
    } catch {
      // nodes are optional for the list; don't surface as a page error
      setNodes([]);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load on mount
  useEffect(() => {
    void loadRoutines();
    void loadNodes();
  }, []);

  async function toggleStatus(id: string) {
    const routine = routines.find((r) => r.id === id);
    if (!routine) return;

    try {
      const body = await fetchJson<{ data: Routine }>(`/api/v1/routines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !routine.enabled }),
      });
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...body.data, trigger: routineTrigger(body.data), status: routineStatus(body.data) }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update routine');
    }
  }

  async function runNow(id: string) {
    try {
      await fetchJson(`/api/v1/routines/${id}/run`, { method: 'POST' });
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, lastRunAt: new Date().toISOString() } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run routine');
    }
  }

  async function createRoutine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let jobInput: Record<string, unknown> = {};
      try {
        jobInput = JSON.parse(draft.jobInput);
      } catch {
        setError('Job input must be valid JSON');
        setSaving(false);
        return;
      }

      await fetchJson('/api/v1/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          cron: draft.cron,
          jobType: draft.jobType,
          jobInput,
          tier: draft.tier,
          enabled: draft.enabled,
          ...(draft.nodeId && { nodeId: draft.nodeId }),
        }),
      });

      setShowForm(false);
      setDraft({
        name: '',
        description: '',
        cron: '0 8 * * *',
        jobType: 'capture',
        jobInput: '{}',
        tier: 0,
        enabled: true,
        nodeId: '',
      });
      await loadRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create routine');
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    return routines.filter((r) => {
      const matchesFilter = active === 'All' || r.trigger === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [routines, active, query]);

  return (
    <div className="space-y-6">
      <PageHeader title="Routines" description="Scheduled playbooks and recurring automations.">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New routine
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createRoutine}
          className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
        >
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">New routine</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="routine-name"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Name
              </label>
              <input
                id="routine-name"
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="routine-description"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Description
              </label>
              <input
                id="routine-description"
                type="text"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div>
              <label
                htmlFor="routine-cron"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Cron schedule
              </label>
              <input
                id="routine-cron"
                type="text"
                required
                value={draft.cron}
                onChange={(e) => setDraft((d) => ({ ...d, cron: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div>
              <label
                htmlFor="routine-job-type"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Job type
              </label>
              <input
                id="routine-job-type"
                type="text"
                required
                value={draft.jobType}
                onChange={(e) => setDraft((d) => ({ ...d, jobType: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div>
              <label
                htmlFor="routine-node"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Run on node
              </label>
              <select
                id="routine-node"
                value={draft.nodeId}
                onChange={(e) => setDraft((d) => ({ ...d, nodeId: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              >
                <option value="">Any node</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="routine-job-input"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Job input (JSON)
              </label>
              <textarea
                id="routine-job-input"
                value={draft.jobInput}
                onChange={(e) => setDraft((d) => ({ ...d, jobInput: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create routine'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                active === f
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search routines"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading routines…
        </div>
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((routine) => {
              const TriggerIcon = triggerIcon[routine.trigger];
              return (
                <motion.div
                  key={routine.id}
                  layout
                  data-testid={`routine-${routine.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-shadow hover:shadow-hover sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        routine.status === 'enabled'
                          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)]'
                      )}
                    >
                      <TriggerIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {routine.name}
                        </h3>
                        <span
                          data-testid="routine-status"
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            routine.status === 'enabled'
                              ? 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                              : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'
                          )}
                        >
                          {routine.status === 'enabled' ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {routine.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {triggerLabel[routine.trigger]}
                        </span>
                        {routine.cron && (
                          <span className="font-mono text-[var(--text-secondary)]">
                            {routine.cron}
                          </span>
                        )}
                        {routine.nextRunAt && routine.status === 'enabled' && (
                          <span>Next: {formatDate(routine.nextRunAt)}</span>
                        )}
                        {routine.nodeId && (
                          <span className="inline-flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            {nodes.find((n) => n.id === routine.nodeId)?.name ?? 'Assigned node'}
                          </span>
                        )}
                        <span data-testid="routine-last-run">
                          Last: {formatDate(routine.lastRunAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    <button
                      type="button"
                      data-testid="routine-run"
                      onClick={() => runNow(routine.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                        'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      <Play className="h-3.5 w-3.5" /> Run now
                    </button>
                    <button
                      type="button"
                      data-testid="routine-toggle"
                      onClick={() => toggleStatus(routine.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                        routine.status === 'enabled'
                          ? 'border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                          : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                      )}
                    >
                      {routine.status === 'enabled' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
                      aria-label="Routine options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl bg-[var(--bg-surface)] p-8 text-center shadow-card">
          <p className="text-sm text-[var(--text-secondary)]">No routines match your filters.</p>
        </div>
      )}
    </div>
  );
}
