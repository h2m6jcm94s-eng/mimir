'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import type { Job, Node } from '@mimir/shared-types';
import { motion } from 'framer-motion';
import { CheckCircle2, Wifi } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CostWidget } from './_components/CostWidget';
import { NodeCard } from './_components/NodeCard';
import { QueueChart } from './_components/QueueChart';
import { TopologyMap } from './_components/TopologyMap';
import type { MeshNode } from './_components/TopologyMap';

interface QueueData {
  hour: string;
  pending: number;
}

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

function computeNodeMetrics(
  nodes: Node[],
  jobs: Job[]
): { metrics: MeshNode[]; totalCostUsd: number } {
  const activeJobs = jobs.filter((job) => job.status === 'running');
  let totalCostUsd = 0;

  const withTarget = activeJobs.filter(
    (job) => job.targetNode && nodes.some((n) => n.id === job.targetNode)
  );
  const fallback = withTarget.length === 0;
  const brain = nodes.find((n) => n.kind === 'brain') ?? nodes[0];

  const metrics = nodes.map((node) => {
    const nodeJobs = fallback
      ? node.id === brain?.id
        ? activeJobs
        : []
      : activeJobs.filter((job) => job.targetNode === node.id);

    const nodeCost = fallback
      ? node.id === brain?.id
        ? jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0)
        : 0
      : jobs
          .filter((job) => job.targetNode === node.id)
          .reduce((sum, job) => sum + (job.costUsd ?? 0), 0);

    totalCostUsd += nodeCost;

    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      tier: node.tier,
      status: node.status === 'unknown' ? 'down' : node.status,
      lastSeen: node.lastSeen,
      jobs: nodeJobs.length,
      cost: microToUsd(nodeCost),
    };
  });

  return { metrics, totalCostUsd };
}

function overallStatus(nodes: MeshNode[]) {
  const up = nodes.filter((n) => n.status === 'up').length;
  if (up === nodes.length) return { label: 'Mesh Healthy', color: 'text-emerald-600' };
  if (up === 0) return { label: 'Mesh Offline', color: 'text-red-600' };
  return { label: 'Mesh Degraded', color: 'text-amber-600' };
}

export default function StatusPage() {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [timeline, setTimeline] = useState<QueueData[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [budgetForecast, setBudgetForecast] = useState<BudgetForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [nodesBody, tasksBody, timelineBody, budgetBody, forecastBody] = await Promise.all([
        fetchJson<{ data: Node[] }>('/api/v1/nodes'),
        fetchJson<{ data: Job[] }>('/api/v1/tasks?limit=50'),
        fetchJson<{ data: QueueData[] }>('/api/v1/tasks/timeline?hours=6'),
        fetchJson<{ data: BudgetStatus }>('/api/v1/budget'),
        fetchJson<{ data: BudgetForecast }>('/api/v1/budget/forecast'),
      ]);

      const { metrics } = computeNodeMetrics(nodesBody.data, tasksBody.data);
      setNodes(metrics);
      setActiveJobs(tasksBody.data.filter((job) => job.status === 'running'));
      setTimeline(timelineBody.data);
      setBudgetStatus(budgetBody.data);
      setBudgetForecast(forecastBody.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
  const queueDepth = timeline.length > 0 ? timeline[timeline.length - 1].pending : 0;
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

      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-8 text-center shadow-card">
          <p className="text-sm font-medium text-[var(--text-primary)]">No nodes enrolled</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Enroll a node to see the mesh topology and health summary.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <TopologyMap nodes={nodes} />
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((node, index) => (
          <NodeCard key={node.id} node={node} index={index} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QueueChart data={timeline.length > 0 ? timeline : [{ hour: '-', pending: 0 }]} />

        <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active jobs</h3>
            <span className="text-xs text-[var(--text-muted)]">{totalJobs} running</span>
          </div>
          <div className="space-y-3">
            {activeJobs.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 text-center text-xs text-[var(--text-muted)]">
                No active jobs
              </div>
            )}
            {activeJobs.map((job) => {
              const input = (job.input ?? {}) as Record<string, unknown>;
              const title = (input.prompt as string) ?? job.type;
              const model = (input.model as string) ?? (input.provider as string) ?? 'local';
              return (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
                    <p className="text-xs capitalize text-[var(--text-muted)]">{model}</p>
                  </div>
                  <TierBadge tier={job.tier} />
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
              );
            })}
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
