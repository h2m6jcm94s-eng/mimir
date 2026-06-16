'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface QueueData {
  hour: string;
  pending: number;
}

export function QueueChart({ data }: { data: QueueData[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.25 }}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Task queue depth</h3>
        <span className="text-xs text-[var(--text-muted)]">Last 6 hours</span>
      </div>
      <div className="h-40">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle-solid)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Bar dataKey="pending" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-raised)]" />
        )}
      </div>
    </motion.div>
  );
}
