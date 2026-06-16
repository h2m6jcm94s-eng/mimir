'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CheckCircle2, Wifi } from 'lucide-react';
import { ConnectorStrip } from './_components/ConnectorStrip';
import { CostWidget } from './_components/CostWidget';
import { NodeCard } from './_components/NodeCard';
import { QueueChart } from './_components/QueueChart';
import { TopologyMap } from './_components/TopologyMap';
import type { MeshNode } from './_components/TopologyMap';

const nodes: MeshNode[] = [
  {
    id: 'laptop',
    name: 'Laptop Brain',
    kind: 'brain',
    tier: 0,
    status: 'up',
    jobs: 2,
    cost: 1.24,
    cpu: 12,
    ram: 34,
    disk: 56,
    net: 8,
  },
  {
    id: 'desktop',
    name: 'Desktop Worker',
    kind: 'desktop',
    tier: 1,
    status: 'up',
    jobs: 4,
    cost: 3.18,
    cpu: 24,
    ram: 42,
    disk: 38,
    net: 12,
  },
  {
    id: 'cloud',
    name: 'Cloud Worker',
    kind: 'cloud',
    tier: 2,
    status: 'degraded',
    jobs: 7,
    cost: 7.42,
    cpu: 68,
    ram: 55,
    disk: 22,
    net: 34,
  },
  {
    id: 'phone',
    name: 'Phone',
    kind: 'phone',
    tier: 1,
    status: 'up',
    jobs: 0,
    cost: 0.12,
    cpu: 4,
    ram: 12,
    disk: 18,
    net: 5,
  },
];

const activeJobs = [
  { id: 1, name: 'Security brief review', model: 'kimi', progress: 72, tier: 1 },
  { id: 2, name: 'Dependency audit', model: 'claude', progress: 34, tier: 0 },
  { id: 3, name: 'Email digest', model: 'ollama', progress: 91, tier: 2 },
];

const queueData = [
  { hour: '09:00', pending: 3 },
  { hour: '10:00', pending: 7 },
  { hour: '11:00', pending: 5 },
  { hour: '12:00', pending: 12 },
  { hour: '13:00', pending: 8 },
  { hour: '14:00', pending: 4 },
];

const costData = [
  { time: '09:00', usd: 0.2 },
  { time: '10:00', usd: 0.8 },
  { time: '11:00', usd: 1.1 },
  { time: '12:00', usd: 2.4 },
  { time: '13:00', usd: 3.1 },
  { time: '14:00', usd: 3.5 },
];

function overallStatus(nodes: MeshNode[]) {
  const up = nodes.filter((n) => n.status === 'up').length;
  if (up === nodes.length) return { label: 'Mesh Healthy', color: 'text-emerald-600' };
  if (up === 0) return { label: 'Mesh Offline', color: 'text-red-600' };
  return { label: 'Mesh Degraded', color: 'text-amber-600' };
}

export default function StatusPage() {
  const status = overallStatus(nodes);
  const totalJobs = nodes.reduce((sum, n) => sum + n.jobs, 0);
  const queueDepth = queueData[queueData.length - 1].pending;

  return (
    <div className="space-y-6">
      <PageHeader title="Status" description="Live mesh topology, nodes, and active jobs.">
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5 text-xs font-semibold', status.color)}>
            {status.label === 'Mesh Healthy' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {status.label}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {nodes.filter((n) => n.status === 'up').length}/{nodes.length} nodes online
          </span>
        </div>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <TopologyMap nodes={nodes} />
      </motion.div>

      <ConnectorStrip />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((node, index) => (
          <NodeCard key={node.id} node={node} index={index} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QueueChart data={queueData} />

        <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active jobs</h3>
            <span className="text-xs text-[var(--text-muted)]">{totalJobs} running</span>
          </div>
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{job.name}</p>
                  <p className="text-xs capitalize text-[var(--text-muted)]">{job.model}</p>
                </div>
                <TierBadge tier={job.tier as 0 | 1 | 2} />
                <div className="w-24">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-primary)]"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
                <span className="w-8 text-right text-xs text-[var(--text-secondary)]">
                  {job.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <CostWidget today={12.0} projected={58} data={costData} />
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Queue depth</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{queueDepth}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Active jobs</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{totalJobs}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Cost burn rate</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">
              $12 today · $58 proj/wk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
