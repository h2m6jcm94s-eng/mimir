'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CheckCircle2, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConnectorStrip } from './_components/ConnectorStrip';
import { CostWidget } from './_components/CostWidget';
import { NodeCard } from './_components/NodeCard';
import { QueueChart } from './_components/QueueChart';
import { TopologyMap } from './_components/TopologyMap';
import type { MeshNode } from './_components/TopologyMap';

interface ApiNode {
  id: string;
  name: string;
  kind: 'brain' | 'desktop' | 'cloud' | 'phone';
  tier: number;
  status: 'up' | 'degraded' | 'down' | 'unknown';
}

interface ApiJob {
  id: string;
  type: string;
  tier: number;
  status: string;
  input?: Record<string, unknown> | null;
  costUsd?: number;
}

const queueData = [
  { hour: '09:00', pending: 3 },
  { hour: '10:00', pending: 7 },
  { hour: '11:00', pending: 5 },
  { hour: '12:00', pending: 12 },
  { hour: '13:00', pending: 8 },
  { hour: '14:00', pending: 4 },
];

interface BudgetStatus {
  dailyBudgetUsd: number;
  dailySpendUsd: number;
  throttled: boolean;
  exceeded: boolean;
  enabled: boolean;
}

interface BudgetForecast {
  projectedEndOfDayUsd: number;
}

const MICROS_PER_DOLLAR = 1_000_000;

function microToUsd(micro: number): number {
  return micro / MICROS_PER_DOLLAR;
}

function mapNode(apiNode: ApiNode): MeshNode {
  return {
    id: apiNode.id,
    name: apiNode.name,
    kind: apiNode.kind,
    tier: apiNode.tier as 0 | 1 | 2,
    status: apiNode.status === 'unknown' ? 'down' : apiNode.status,
    jobs: 0,
    cost: 0,
    cpu: 0,
    ram: 0,
    disk: 0,
    net: 0,
  };
}

function overallStatus(nodes: MeshNode[]) {
  const up = nodes.filter((n) => n.status === 'up').length;
  if (up === nodes.length) return { label: 'Mesh Healthy', color: 'text-emerald-600' };
  if (up === 0) return { label: 'Mesh Offline', color: 'text-red-600' };
  return { label: 'Mesh Degraded', color: 'text-amber-600' };
}

export default function StatusPage() {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [activeJobs, setActiveJobs] = useState<ApiJob[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [budgetForecast, setBudgetForecast] = useState<BudgetForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [nodesRes, tasksRes, budgetRes, forecastRes] = await Promise.all([
          fetch('/api/v1/nodes', {
            // TODO: replace dev stub token with Clerk session JWT.
            headers: { Authorization: 'Bearer test' },
          }),
          fetch('/api/v1/tasks?limit=50', {
            // TODO: replace dev stub token with Clerk session JWT.
            headers: { Authorization: 'Bearer test' },
          }),
          fetch('/api/v1/budget', { credentials: 'include' }),
          fetch('/api/v1/budget/forecast', { credentials: 'include' }),
        ]);

        if (!nodesRes.ok) throw new Error(`Nodes fetch failed: ${nodesRes.status}`);
        if (!tasksRes.ok) throw new Error(`Tasks fetch failed: ${tasksRes.status}`);
        if (!budgetRes.ok) throw new Error(`Budget fetch failed: ${budgetRes.status}`);
        if (!forecastRes.ok) throw new Error(`Forecast fetch failed: ${forecastRes.status}`);

        const nodesBody = (await nodesRes.json()) as { data: ApiNode[] };
        const tasksBody = (await tasksRes.json()) as { data: ApiJob[] };
        const budgetBody = (await budgetRes.json()) as { data: BudgetStatus };
        const forecastBody = (await forecastRes.json()) as { data: BudgetForecast };

        setNodes(nodesBody.data.map(mapNode));
        setActiveJobs(tasksBody.data.filter((job) => job.status === 'running'));
        setBudgetStatus(budgetBody.data);
        setBudgetForecast(forecastBody.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load status');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">Loading status…</div>
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

  const status = overallStatus(nodes);
  const totalJobs = activeJobs.length;
  const queueDepth = queueData[queueData.length - 1].pending;
  const onlineCount = nodes.filter((n) => n.status === 'up').length;
  const todayUsd = microToUsd(budgetStatus?.dailySpendUsd ?? 0);
  const projectedUsd = microToUsd(budgetForecast?.projectedEndOfDayUsd ?? 0);
  const costData = [0, 1, 2, 3, 4, 5].map((i) => ({
    time: `${9 + i}:00`,
    usd: todayUsd * (i / 5),
  }));

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
            {onlineCount}/{nodes.length} nodes online
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
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {typeof job.input?.prompt === 'string' ? job.input.prompt : job.type}
                  </p>
                  <p className="text-xs capitalize text-[var(--text-muted)]">
                    {typeof job.input?.model === 'string' ? job.input.model : 'kimi'}
                  </p>
                </div>
                <TierBadge tier={job.tier as 0 | 1 | 2} />
                <div className="w-24">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-primary)]"
                      style={{ width: '0%' }}
                    />
                  </div>
                </div>
                <span className="w-8 text-right text-xs text-[var(--text-secondary)]">0%</span>
              </div>
            ))}
          </div>
        </div>

        <CostWidget today={todayUsd} projected={projectedUsd} data={costData} />
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
              ${todayUsd.toFixed(2)} today · ${projectedUsd.toFixed(2)} projected EOD
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
