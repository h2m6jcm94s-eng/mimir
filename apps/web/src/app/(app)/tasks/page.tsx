'use client';

import { ModelBadge } from '@/components/ui/ModelBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, MoreHorizontal, Play, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type Status = 'Queued' | 'Running' | 'Blocked' | 'Needs Attention' | 'Done';

interface Task {
  id: string;
  title: string;
  description: string;
  blastRadius: string;
  status: Status;
  tier: 0 | 1 | 2;
  model: 'kimi' | 'claude' | 'ollama';
  cost: number;
}

interface ApiJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'blocked' | 'needs_attention' | 'done' | 'failed';
  tier: number;
  input?: Record<string, unknown> | null;
  costUsd: number;
}

const columns: Status[] = ['Queued', 'Running', 'Blocked', 'Needs Attention', 'Done'];

const columnMeta: Record<Status, { color: string; border: string; icon: typeof Play }> = {
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
};

const statusMap: Record<ApiJob['status'], Status | null> = {
  queued: 'Queued',
  running: 'Running',
  blocked: 'Blocked',
  needs_attention: 'Needs Attention',
  done: 'Done',
  failed: 'Blocked',
};

function classifyModel(input: ApiJob['input']): Task['model'] {
  if (typeof input?.model === 'string') {
    const m = input.model.toLowerCase();
    if (m.includes('claude')) return 'claude';
    if (m.includes('ollama')) return 'ollama';
  }
  const checkpoint = input?.checkpoint;
  if (typeof checkpoint === 'object' && checkpoint && 'classification' in checkpoint) {
    const classification = checkpoint.classification as Record<string, unknown> | undefined;
    const provider = classification?.provider;
    if (provider === 'anthropic') return 'claude';
    if (provider === 'ollama') return 'ollama';
  }
  return 'kimi';
}

function mapJobToTask(job: ApiJob): Task {
  const status = statusMap[job.status] ?? 'Queued';
  const prompt = typeof job.input?.prompt === 'string' ? job.input.prompt : undefined;
  return {
    id: job.id,
    title: job.type || `Task ${job.id.slice(0, 6)}`,
    description: prompt ?? 'No description provided.',
    blastRadius: '1 task · 0 services affected',
    status,
    tier: (job.tier as 0 | 1 | 2) ?? 0,
    model: classifyModel(job.input),
    cost: (job.costUsd ?? 0) / 1_000_000,
  };
}

function TaskCard({
  task,
  onStatusChange,
}: { task: Task; onStatusChange: (id: string, status: Status) => void }) {
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
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          Move
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as Status)}
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
    </motion.div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/v1/tasks?limit=100', {
          // TODO: replace dev stub token with Clerk session JWT.
          headers: { Authorization: 'Bearer test' },
        });
        if (!res.ok) throw new Error(`Tasks fetch failed: ${res.status}`);
        const body = (await res.json()) as { data: ApiJob[] };
        setTasks(body.data.map(mapJobToTask));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function handleStatusChange(id: string, status: Status) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
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

      <div className="grid gap-4 lg:grid-cols-5">
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
                  {colTasks.length}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                <div className="flex-1 space-y-2">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
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
