'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Coins, Cpu, DollarSign, TrendingUp, Wallet, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Transaction {
  id: number;
  model: string;
  skill: string;
  tier: 0 | 1 | 2;
  tokens: number;
  cost: number;
  time: string;
}

interface DailySpend {
  date: string;
  usd: number;
}

interface TierSpend {
  tier: 0 | 1 | 2;
  usd: number;
}

const dailySpend: DailySpend[] = [
  { date: 'Mon', usd: 4.2 },
  { date: 'Tue', usd: 6.8 },
  { date: 'Wed', usd: 5.1 },
  { date: 'Thu', usd: 9.3 },
  { date: 'Fri', usd: 7.5 },
  { date: 'Sat', usd: 3.4 },
  { date: 'Sun', usd: 12.0 },
];

const tierSpend: TierSpend[] = [
  { tier: 0, usd: 14.2 },
  { tier: 1, usd: 22.5 },
  { tier: 2, usd: 11.8 },
];

const transactions: Transaction[] = [
  {
    id: 1,
    model: 'Kimi K2',
    skill: 'Security brief',
    tier: 2,
    tokens: 12400,
    cost: 0.124,
    time: '10:28',
  },
  {
    id: 2,
    model: 'Claude 4',
    skill: 'Code review',
    tier: 1,
    tokens: 8600,
    cost: 0.086,
    time: '10:15',
  },
  {
    id: 3,
    model: 'Llama 4 Scout',
    skill: 'Local search',
    tier: 0,
    tokens: 3200,
    cost: 0.0,
    time: '09:52',
  },
  {
    id: 4,
    model: 'Kimi K2',
    skill: 'Governance audit',
    tier: 2,
    tokens: 18200,
    cost: 0.182,
    time: '09:30',
  },
  {
    id: 5,
    model: 'Claude 4',
    skill: 'Memory compression',
    tier: 1,
    tokens: 5400,
    cost: 0.054,
    time: '09:12',
  },
];

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
    >
      <div className="mb-2 flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div
        className={cn(
          'text-2xl font-semibold',
          tone === 'danger'
            ? 'text-[var(--accent-danger)]'
            : tone === 'warning'
              ? 'text-[var(--accent-warning)]'
              : 'text-[var(--text-primary)]'
        )}
      >
        {value}
      </div>
      {subtext && <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtext}</p>}
    </motion.div>
  );
}

function DailySpendChart({ data }: { data: DailySpend[] }) {
  const [mounted, setMounted] = useState(false);
  const gradientId = useId();
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.25 }}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Daily spend</h3>
        <span className="text-xs text-[var(--text-muted)]">Last 7 days</span>
      </div>
      <div className="h-48">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
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
                fill={`url(#${gradientId})`}
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

function TierSpendChart({ data }: { data: TierSpend[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.25 }}
      className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Spend by tier</h3>
        <span className="text-xs text-[var(--text-muted)]">USD</span>
      </div>
      <div className="h-48">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data}>
              <XAxis
                dataKey="tier"
                tickFormatter={(v) => `T${v}`}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
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
              <Bar dataKey="usd" radius={[4, 4, 0, 0]} fill="var(--accent-primary)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-raised)]" />
        )}
      </div>
    </motion.div>
  );
}

export default function CostPage() {
  const today = 12.0;
  const projected = 58.4;
  const [budget, setBudget] = useState(50);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  const remaining = useMemo(() => Math.max(0, budget - today), [budget]);
  const burnPct = useMemo(() => Math.min(100, (today / budget) * 100), [budget]);
  const topModel = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      totals.set(t.model, (totals.get(t.model) || 0) + t.cost);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  }, []);

  const overBudget = projected > budget;

  return (
    <div className="space-y-6">
      <PageHeader title="Cost" description="Track token spend, model usage, and budget health." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={DollarSign} label="Total today" value={`$${today.toFixed(2)}`} />
        <SummaryCard
          icon={TrendingUp}
          label="Projected this week"
          value={`$${projected.toFixed(2)}`}
          subtext="Based on current burn rate"
        />
        <SummaryCard
          icon={Wallet}
          label="Budget remaining"
          value={`$${remaining.toFixed(2)}`}
          subtext={`$${today.toFixed(2)} of $${budget.toFixed(2)} used`}
          tone={remaining < 10 ? 'warning' : 'default'}
        />
        <SummaryCard icon={Cpu} label="Top model" value={topModel} subtext="By cumulative spend" />
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)]">Budget burn</span>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {burnPct.toFixed(0)}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface-raised)]"
          role="progressbar"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number(burnPct.toFixed(0))}
          aria-label="Budget used"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${burnPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              burnPct > 90 ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent-primary)]'
            )}
          />
        </div>
      </div>

      <AnimatePresence>
        {overBudget && !dismissedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start justify-between gap-4 rounded-xl border border-[var(--accent-warning)]/20 bg-[var(--accent-warning)]/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--accent-warning)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Projected weekly spend (${projected.toFixed(2)}) exceeds your ${budget.toFixed(2)}{' '}
                  budget.
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Increase the limit or reduce cloud-tier usage.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="budget-input" className="text-xs text-[var(--text-secondary)]">
                    Budget limit
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                      $
                    </span>
                    <input
                      id="budget-input"
                      type="number"
                      min={0}
                      step={1}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="h-8 w-24 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] pl-5 pr-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedAlert(true)}
              className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              aria-label="Dismiss budget alert"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailySpendChart data={dailySpend} />
        <TierSpendChart data={tierSpend} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.25 }}
        className="overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-card"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle-solid)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent transactions</h3>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Coins className="h-3 w-3" /> {transactions.length} today
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 font-medium">Tokens</th>
                <th className="px-4 py-2 font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle-solid)]">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{t.model}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{t.skill}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={t.tier} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                    {t.tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                    ${t.cost.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
