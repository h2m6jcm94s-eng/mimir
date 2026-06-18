'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Cloud, Laptop, Monitor, Smartphone } from 'lucide-react';

export type NodeKind = 'brain' | 'desktop' | 'cloud' | 'phone';

export interface MeshNode {
  id: string;
  name: string;
  kind: NodeKind;
  tier: 0 | 1 | 2;
  status: 'up' | 'degraded' | 'down';
  lastSeen?: string;
  jobs: number;
  cost: number;
  cpu?: number;
  ram?: number;
  disk?: number;
  net?: number;
}

const icons: Record<NodeKind, typeof Laptop> = {
  brain: Laptop,
  desktop: Monitor,
  cloud: Cloud,
  phone: Smartphone,
};

const positions: Record<NodeKind, { x: number; y: number }> = {
  brain: { x: 50, y: 18 },
  desktop: { x: 18, y: 50 },
  cloud: { x: 82, y: 50 },
  phone: { x: 50, y: 82 },
};

const connections: { from: NodeKind; to: NodeKind }[] = [
  { from: 'brain', to: 'desktop' },
  { from: 'brain', to: 'cloud' },
  { from: 'brain', to: 'phone' },
  { from: 'desktop', to: 'phone' },
  { from: 'cloud', to: 'phone' },
];

function statusColor(status: MeshNode['status']) {
  return status === 'up' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-red-500';
}

function statusGlow(status: MeshNode['status']) {
  return status === 'up'
    ? 'shadow-[0_0_0_4px_rgba(16,185,129,0.15)]'
    : status === 'degraded'
      ? 'shadow-[0_0_0_4px_rgba(245,158,11,0.15)]'
      : 'shadow-[0_0_0_4px_rgba(239,68,68,0.15)]';
}

export function TopologyMap({ nodes }: { nodes: MeshNode[] }) {
  const nodeMap = new Map(nodes.map((n) => [n.kind, n]));

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card">
      <svg
        role="img"
        aria-label="Mesh topology connections"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {connections.map(({ from, to }) => {
          const a = positions[from];
          const b = positions[to];
          return (
            <g key={`${from}-${to}`}>
              <line
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                className="stroke-[var(--border-subtle-solid)]"
                strokeWidth={1.5}
              />
              <line
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                className="animate-dash-flow stroke-[var(--accent-primary)]"
                strokeWidth={2}
                strokeDasharray="4 8"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>

      {nodes.map((node) => {
        const pos = positions[node.kind];
        const Icon = icons[node.kind];
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl bg-[var(--bg-primary)] p-2.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
                statusGlow(node.status)
              )}
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--accent-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-primary)]',
                    statusColor(node.status)
                  )}
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold text-[var(--text-primary)]">{node.name}</p>
                <p className="text-[9px] text-[var(--text-muted)]">
                  {node.jobs} jobs · ${node.cost.toFixed(2)}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
