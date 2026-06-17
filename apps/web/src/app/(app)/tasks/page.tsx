'use client';

import { ModelBadge } from '@/components/ui/ModelBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import type { Job } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, MoreHorizontal, Play, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type TaskStatus = 'Queued' | 'Running' | 'Blocked' | 'Needs Attention' | 'Done' | 'Failed';

const columns: TaskStatus[] = ['Queued', 'Running', 'Blocked', 'Needs Attention', 'Done', 'Failed'];

const columnMeta: Record<TaskStatus, { color: string; border: string; icon: typeof Play }> = {
  Queued: { color: 'bg-blue-500/10 text-blue-600', border: 'border-blue-500/20', icon: Play },
  Running: {
    color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',
    border: 'border-[var(--accent-teal)]/20',
    icon: RefreshCw,
  },
  Blocked: {
    color: 'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]',
    border: 'border-[var(--accent-warning)]/20',
    icon: AlertTriangle,
  },
  'Needs Attention': {
    color: 'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]',
    border: 'border-[var(--accent-danger)]/20',
    icon: AlertTriangle,
  },
  Done: {
    color: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
    border: 'border-[var(--text-muted)]/20',
    icon: Play,
  },
  Failed: {
    color: 'bg-red-500/10 text-red-600',
    border: 'border-red-500/20',
    icon: AlertTriangle,
  },
};

const statusMap: Record<Job['status'], TaskStatus> = {
  queued: 'Queued',
  running: 'Running',
  blocked: 'Blocked',
  needs_attention: 'Needs Attention',
  done: 'Done',
  failed: 'Failed',
};

const reverseStatusMap: Record<TaskStatus, Job['status']> = {
  Queued: 'queued',
  Running: 'running',
  Blocked: 'blocked',
  'Needs Attention': 'needs_attention',
  Done: 'done',
  Failed: 'failed',
};

function deriveModel(input: Record<string, unknown> | null | undefined): string {
  const payload = (input?.payload as Record<string, unknown> | undefined) ?? input;
  return (
    (payload?.model as string | undefined) ?? (payload?.provider as string | undefined) ?? 'local'
  );
}

function deriveBlastRadius(job: Job): string {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const attachments = Array.isArray(input.attachments) ? input.attachments.length : 0;
  return `${attachments} attachment${attachments === 1 ? '' : 's'} · ${job.type}`;
}

function mapJobToTask(job: Job): Task {
  const input = (job.input ?? {}) as Record<string, unknown>;
  return {
    id: job.id,
    title: job.type || `Task ${job.id.slice(0, 6)}`,
    description: (input.prompt as string) ?? 'No description provided.',
    blastRadius: deriveBlastRadius(job),
    status: statusMap[job.status],
    tier: job.tier,
    model: deriveModel(input),
    cost: (job.costUsd ?? 0) / 1_000_000,
    retryCount: job.retryCount ?? 0,
    maxRetries: job.maxRetries ?? 3,
  };
}

interface Task {
  id: string;
  title: string;
  description: string;
  blastRadius: string;
  status: TaskStatus;
  tier: 0 | 1 | 2;
  model: string;
  cost: number;
  retryCount: number;
  maxRetries: number;
}

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

function TaskCard({
  task,
  onStatusChange,
  onRetry,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onRetry: (id: string) => void;
}) {
  const meta = columnMeta[task.status];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      data-testid={`task-card-${task.id}`}
      className={cn(
        'rounded-xl border bg-[var(--bg-primary)] p-3 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        meta.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-[var(--text-primary)]">{task.title}</h4>
        <button
          type="button"
          aria-label="Task options"
          className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)]"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
        {task.description}
      </p>
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">{task.blastRadius}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ModelBadge model={task.model} />
        <TierBadge tier={task.tier} />
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
            meta.color
          )}
        >
          {task.status === 'Running' && <Icon className="h-3 w-3 animate-spin" />}
          {task.status !== 'Running' && <Icon className="h-3 w-3" />}
          {task.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle-solid)] pt-2">
        <span className="text-xs text-[var(--text-muted)]">${task.cost.toFixed(3)}</span>
        <div className="flex items-center gap-2">
          {task.status === 'Failed' && task.retryCount < task.maxRetries && (
            <button
              type="button"
              onClick={() => onRetry(task.id)}
              className="inline-flex items-center gap-1 rounded bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
            Move
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
              className="rounded border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[10px] outline-none focus:border-[var(--border-focus)]"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </motion.div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [listBody, countsBody] = await Promise.all([
        fetchJson<{ data: Job[] }>('/api/v1/tasks?limit=100'),
        fetchJson<{ counts: Record<string, number> }>('/api/v1/tasks/counts'),
      ]);
      setTasks(listBody.data.map(mapJobToTask));
      setCounts(countsBody.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(id: string, status: TaskStatus) {
    const previous = tasks.find((t) => t.id === id);
    if (!previous || previous.status === status) return;

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));

    try {
      await fetchJson(`/api/v1/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: reverseStatusMap[status] }),
      });
      const countsBody = await fetchJson<{ counts: Record<string, number> }>(
        '/api/v1/tasks/counts'
      );
      setCounts(countsBody.counts);
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleRetry(id: string) {
    try {
      await fetchJson(`/api/v1/tasks/${id}/retry`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">Loading tasks…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Workflows moving through build, review, and apply.">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-6">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          const meta = columnMeta[col];
          const Icon = meta.icon;
          return (
            <div
              key={col}
              className="flex flex-col rounded-xl bg-[var(--bg-surface)] p-3 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', col === 'Running' && 'animate-spin')} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{col}</h3>
                </div>
                <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                  {counts[reverseStatusMap[col]] ?? 0}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                <div className="flex-1 space-y-2">
                  {colTasks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-2 py-4 text-center text-[10px] text-[var(--text-muted)]">
                      No {col.toLowerCase()} tasks
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
