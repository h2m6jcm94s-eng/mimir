'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

interface CostPoint {
  time: string;
  usd: number;
}

export function CostWidget({
  today,
  projected,
  data,
}: { today: number; projected: number; data: CostPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.25 }}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cost today</h3>
        <span className="text-xs text-[var(--text-muted)]">proj/wk ${projected}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--text-primary)]">
          ${today.toFixed(2)}
        </span>
        <span className="text-xs text-[var(--text-muted)]">today</span>
      </div>
      <div className="mt-2 h-24">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle-solid)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                formatter={(value) =>
                  typeof value === 'number'
                    ? [`$${value.toFixed(2)}`, 'Spend']
                    : [String(value), 'Spend']
                }
              />
              <Area
                type="monotone"
                dataKey="usd"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                fill="url(#costGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-raised)]" />
        )}
      </div>
    </motion.div>
  );
}
