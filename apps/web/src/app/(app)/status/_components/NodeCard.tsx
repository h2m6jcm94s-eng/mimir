'use client';

import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Cloud, HardDrive, Laptop, Monitor, Smartphone, Wifi } from 'lucide-react';
import type { MeshNode, NodeKind } from './TopologyMap';

const icons: Record<NodeKind, typeof Laptop> = {
  brain: Laptop,
  desktop: Monitor,
  cloud: Cloud,
  phone: Smartphone,
};

function statusColor(status: MeshNode['status']) {
  return status === 'up'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'degraded'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
}

function formatLastSeen(value: string | undefined): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function NodeCard({ node, index }: { node: MeshNode; index: number }) {
  const Icon = icons[node.kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      data-testid={`node-card-${node.id}`}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              statusColor(node.status)
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{node.name}</h3>
            <p className="text-xs capitalize text-[var(--text-muted)]">{node.kind}</p>
          </div>
        </div>
        <TierBadge tier={node.tier as 0 | 1 | 2} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-[var(--bg-primary)] p-2">
          <p className="text-[10px] text-[var(--text-muted)]">Active jobs</p>
          <p className="font-semibold text-[var(--text-primary)]">{node.jobs}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-primary)] p-2">
          <p className="text-[10px] text-[var(--text-muted)]">Cost today</p>
          <p className="font-semibold text-[var(--text-primary)]">${node.cost.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle-solid)] pt-3 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          {node.status}
        </span>
        <span className="flex items-center gap-1" title={node.lastSeen ?? undefined}>
          <HardDrive className="h-3 w-3" />
          {formatLastSeen(node.lastSeen)}
        </span>
      </div>
    </motion.div>
  );
}
