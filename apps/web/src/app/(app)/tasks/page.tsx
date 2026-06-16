'use client';

import { ModelBadge } from '@/components/ui/ModelBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, MoreHorizontal, Play, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';

type Status = 'Queued' | 'Running' | 'Blocked' | 'Needs Attention' | 'Done';

interface Task {
  id: number;
  title: string;
  description: string;
  blastRadius: string;
  status: Status;
  tier: 0 | 1 | 2;
  model: 'kimi' | 'claude' | 'ollama';
  cost: number;
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

const initialTasks: Task[] = [
  {
    id: 1,
    title: 'Weekly security brief',
    description: 'Compile alerts and incidents into a digest.',
    blastRadius: '1 briefing · 0 services affected',
    status: 'Running',
    tier: 0,
    model: 'kimi',
    cost: 0.004,
  },
  {
    id: 2,
    title: 'Dependency audit',
    description: 'Review new packages for license and security issues.',
    blastRadius: '3 packages · 2 services affected',
    status: 'Queued',
    tier: 0,
    model: 'claude',
    cost: 0.002,
  },
  {
    id: 3,
    title: 'Email digest',
    description: 'Summarize unread threads and draft replies.',
    blastRadius: '12 threads · 1 reply drafted',
    status: 'Needs Attention',
    tier: 2,
    model: 'ollama',
    cost: 0.001,
  },
  {
    id: 4,
    title: 'Tailscale node patch',
    description: 'Apply patch to the relay node.',
    blastRadius: '1 node · 4 users affected',
    status: 'Blocked',
    tier: 1,
    model: 'kimi',
    cost: 0.0,
  },
  {
    id: 5,
    title: 'Clerk key rotation',
    description: 'Rotate signing key and verify downstream services.',
    blastRadius: 'All auth sessions · 120 users',
    status: 'Done',
    tier: 2,
    model: 'claude',
    cost: 0.0,
  },
];

function TaskCard({
  task,
  onStatusChange,
}: { task: Task; onStatusChange: (id: number, status: Status) => void }) {
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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  function handleStatusChange(id: number, status: Status) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
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
