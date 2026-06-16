'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, MoreHorizontal, Play, Plus, Search, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

type TriggerType = 'scheduled' | 'webhook' | 'manual';
type RoutineStatus = 'enabled' | 'disabled';

interface Routine {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  schedule?: string;
  lastRun?: string;
  nextRun?: string;
  status: RoutineStatus;
}

const initialRoutines: Routine[] = [
  {
    id: 'morning-brief',
    name: 'Morning Brief',
    description: 'Compile overnight security, calendar, and task updates.',
    trigger: 'scheduled',
    schedule: '0 8 * * *',
    lastRun: 'Today, 08:00',
    nextRun: 'Tomorrow, 08:00',
    status: 'enabled',
  },
  {
    id: 'dependency-audit',
    name: 'Dependency Audit',
    description: 'Scan repos for CVEs and outdated packages.',
    trigger: 'scheduled',
    schedule: '0 9 * * 1',
    lastRun: 'Mon, 09:00',
    nextRun: 'Next Mon, 09:00',
    status: 'enabled',
  },
  {
    id: 'standup-prep',
    name: 'Standup Prep',
    description: 'Generate talking points from commits and task moves.',
    trigger: 'webhook',
    lastRun: 'Yesterday',
    status: 'disabled',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Produce a written summary of cost, tasks, and approvals.',
    trigger: 'manual',
    lastRun: 'Never',
    status: 'disabled',
  },
];

const filters: Array<TriggerType | 'All'> = ['All', 'scheduled', 'webhook', 'manual'];

const triggerIcon: Record<TriggerType, React.ElementType> = {
  scheduled: Clock,
  webhook: Zap,
  manual: Calendar,
};

const triggerLabel: Record<TriggerType, string> = {
  scheduled: 'Scheduled',
  webhook: 'Webhook',
  manual: 'Manual',
};

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [active, setActive] = useState<TriggerType | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return routines.filter((r) => {
      const matchesFilter = active === 'All' || r.trigger === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [routines, active, query]);

  function toggleStatus(id: string) {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === 'enabled' ? 'disabled' : 'enabled' } : r
      )
    );
  }

  function runNow(id: string) {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, lastRun: 'Just now' } : r)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routines"
        description="Scheduled playbooks, webhook triggers, and recurring automations."
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New routine
        </button>
      </PageHeader>

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
                      {routine.schedule && (
                        <span className="font-mono text-[var(--text-secondary)]">
                          {routine.schedule}
                        </span>
                      )}
                      {routine.nextRun && routine.status === 'enabled' && (
                        <span>Next: {routine.nextRun}</span>
                      )}
                      <span data-testid="routine-last-run">Last: {routine.lastRun}</span>
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

      {filtered.length === 0 && (
        <div className="rounded-xl bg-[var(--bg-surface)] p-8 text-center shadow-card">
          <p className="text-sm text-[var(--text-secondary)]">No routines match your filters.</p>
        </div>
      )}
    </div>
  );
}
