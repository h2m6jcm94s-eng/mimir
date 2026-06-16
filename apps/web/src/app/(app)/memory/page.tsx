'use client';

import { Background, Controls, type Edge, MiniMap, type Node, ReactFlow } from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import '@xyflow/react/dist/style.css';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, BrainCircuit, Clock, GitBranch, History, RotateCcw } from 'lucide-react';

const checkpoints = [
  {
    id: 1,
    label: 'Initial memory seed',
    timestamp: '2026-06-10 08:00',
    size: '12 KB',
    model: 'kimi',
  },
  {
    id: 2,
    label: 'Security brief absorbed',
    timestamp: '2026-06-12 14:32',
    size: '34 KB',
    model: 'kimi',
  },
  {
    id: 3,
    label: 'User preference: terse replies',
    timestamp: '2026-06-13 09:15',
    size: '2 KB',
    model: 'claude',
  },
  { id: 4, label: 'Current', timestamp: '2026-06-16 10:30', size: '58 KB', model: 'kimi' },
];

const memoryNodes: Node[] = [
  {
    id: '1',
    position: { x: 250, y: 100 },
    data: { label: 'Mimir identity' },
    style: { background: '#4338CA', color: '#fff' },
  },
  {
    id: '2',
    position: { x: 100, y: 200 },
    data: { label: 'Security facts' },
    style: { background: '#0D9488' },
  },
  {
    id: '3',
    position: { x: 400, y: 200 },
    data: { label: 'User preferences' },
    style: { background: '#D97706' },
  },
  {
    id: '4',
    position: { x: 250, y: 300 },
    data: { label: 'Workflow patterns' },
    style: { background: '#64748B' },
  },
];

const memoryEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'retrieves' },
  { id: 'e1-3', source: '1', target: '3', label: 'uses' },
  { id: 'e2-4', source: '2', target: '4', label: 'shapes' },
  { id: 'e3-4', source: '3', target: '4', label: 'shapes' },
];

export default function MemoryPage() {
  const [tab, setTab] = useState<'time' | 'graph'>('time');
  const [selected, setSelected] = useState(checkpoints[checkpoints.length - 1].id);
  const [compare, setCompare] = useState<number | null>(null);

  const current = checkpoints.find((c) => c.id === selected) ?? checkpoints[0];
  const previous =
    checkpoints.find((c) => c.id === compare) ?? checkpoints[checkpoints.indexOf(current) - 1];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory"
        description="Time-machine checkpoints and interactive knowledge graph."
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('time')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'time'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <History className="h-3.5 w-3.5" /> Time Machine
        </button>
        <button
          type="button"
          onClick={() => setTab('graph')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'graph'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <BrainCircuit className="h-3.5 w-3.5" /> Graph Memory
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'time' ? (
          <motion.div
            key="time"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid gap-4 lg:grid-cols-3"
          >
            <div className="space-y-4 lg:col-span-1">
              <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                  Checkpoints
                </h3>
                <div className="relative space-y-0">
                  {checkpoints.map((cp, index) => {
                    const active = cp.id === selected;
                    return (
                      <motion.button
                        key={cp.id}
                        type="button"
                        onClick={() => setSelected(cp.id)}
                        onMouseEnter={() => setCompare(cp.id === selected ? null : cp.id)}
                        onMouseLeave={() => setCompare(null)}
                        whileHover={{ x: 4 }}
                        className="relative flex w-full items-start gap-3 py-3 text-left"
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                              active
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                                : 'border-[var(--border-subtle-solid)] bg-[var(--bg-primary)]'
                            )}
                          >
                            {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          {index < checkpoints.length - 1 && (
                            <div className="mt-1 h-full w-px bg-[var(--border-subtle-solid)]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                            )}
                          >
                            {cp.label}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {cp.timestamp} · {cp.size}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-warning)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-warning)] transition-colors hover:bg-[var(--accent-warning)]/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Rewind
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"
                >
                  <Clock className="h-3.5 w-3.5" /> Restore
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-surface-raised)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle-solid)]"
                >
                  <GitBranch className="h-3.5 w-3.5" /> Branch
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Diff view</h3>
                {compare && previous && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {previous.label} → {current.label}
                  </span>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    {previous ? previous.label : 'No comparison'}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {previous
                      ? `Memory size: ${previous.size}. Model: ${previous.model}. Contains ${previous.id * 3} facts.`
                      : 'Hover a checkpoint to compare.'}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--accent-primary)]">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {current.label}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Memory size: {current.size}. Model: {current.model}. Contains{' '}
                    {current.id * 3 + 1} facts.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="graph"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="h-[60vh] rounded-xl bg-[var(--bg-surface)] p-2 shadow-card"
          >
            <ReactFlow nodes={memoryNodes} edges={memoryEdges} fitView>
              <Background gap={16} />
              <Controls />
              <MiniMap className="hidden lg:block" />
            </ReactFlow>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
