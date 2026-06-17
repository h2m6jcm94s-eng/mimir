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

interface DailySpend {
  date: string;
  usd: number;
}

interface TierSpend {
  tier: 0 | 1 | 2;
  usd: number;
}

interface BudgetStatus {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  dailySpendUsd: number;
  monthlySpendUsd: number;
  dailyRemainingUsd: number;
  monthlyRemainingUsd: number;
  throttleThreshold: number;
  throttled: boolean;
  exceeded: boolean;
  enabled: boolean;
}

interface BudgetForecast {
  projectedEndOfDayUsd: number;
  projectedMonthEndUsd: number;
  daysUntilDailyBudgetDepleted: number | null;
  daysUntilMonthlyBudgetDepleted: number | null;
  averageHourlyBurnUsd: number;
}

interface ApiJob {
  id: string;
  type: string;
  tier: number;
  status: string;
  costUsd?: number;
  createdAt: string;
  input?: Record<string, unknown> | null;
}

const MICROS_PER_DOLLAR = 1_000_000;

function microToUsd(micro: number): number {
  return micro / MICROS_PER_DOLLAR;
}

function formatUsd(micro: number): string {
  return `$${microToUsd(micro).toFixed(2)}`;
}

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
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [forecast, setForecast] = useState<BudgetForecast | null>(null);
  const [dailySpend, setDailySpend] = useState<DailySpend[]>([]);
  const [tierSpend, setTierSpend] = useState<TierSpend[]>([]);
  const [transactions, setTransactions] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  const budgetInput = status?.dailyBudgetUsd ?? 0;
  const [budgetDraft, setBudgetDraft] = useState(microToUsd(budgetInput));

  useEffect(() => {
    setBudgetDraft(microToUsd(budgetInput));
  }, [budgetInput]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [statusRes, forecastRes, spendRes, tasksRes] = await Promise.all([
          fetch('/api/v1/budget', { credentials: 'include' }),
          fetch('/api/v1/budget/forecast', { credentials: 'include' }),
          fetch('/api/v1/budget/spend', { credentials: 'include' }),
          fetch('/api/v1/tasks?limit=50', { credentials: 'include' }),
        ]);

        if (!statusRes.ok) throw new Error(`Budget status failed: ${statusRes.status}`);
        if (!forecastRes.ok) throw new Error(`Forecast failed: ${forecastRes.status}`);
        if (!spendRes.ok) throw new Error(`Spend series failed: ${spendRes.status}`);
        if (!tasksRes.ok) throw new Error(`Tasks failed: ${tasksRes.status}`);

        const statusBody = (await statusRes.json()) as { data: BudgetStatus };
        const forecastBody = (await forecastRes.json()) as { data: BudgetForecast };
        const spendBody = (await spendRes.json()) as {
          data: { daily: DailySpend[]; tier: TierSpend[] };
        };
        const tasksBody = (await tasksRes.json()) as { data: ApiJob[] };

        setStatus(statusBody.data);
        setForecast(forecastBody.data);
        setDailySpend(spendBody.data.daily);
        setTierSpend(spendBody.data.tier);
        setTransactions(tasksBody.data.filter((j) => (j.costUsd ?? 0) > 0));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cost data');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function saveBudget() {
    if (!status?.enabled) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/v1/budget', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyBudgetUsd: Math.round(budgetDraft * MICROS_PER_DOLLAR),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setSaveError(data.error?.message || 'Failed to save budget');
      } else {
        const statusRes = await fetch('/api/v1/budget', { credentials: 'include' });
        if (statusRes.ok) {
          const body = (await statusRes.json()) as { data: BudgetStatus };
          setStatus(body.data);
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  const today = status?.dailySpendUsd ?? 0;
  const projected = forecast?.projectedEndOfDayUsd ?? 0;
  const budget = status?.dailyBudgetUsd ?? 0;
  const remaining = status?.dailyRemainingUsd ?? 0;
  const burnPct = budget > 0 ? Math.min(100, (today / budget) * 100) : 0;
  const overBudget = projected > budget && budget > 0;
  const throttled = status?.throttled ?? false;
  const exceeded = status?.exceeded ?? false;

  const topModel = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      const model = typeof t.input?.model === 'string' ? t.input.model : t.type;
      totals.set(model, (totals.get(model) ?? 0) + (t.costUsd ?? 0));
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? '—';
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">Loading cost data…</div>
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

  return (
    <div className="space-y-6">
      <PageHeader title="Cost" description="Track token spend, model usage, and budget health." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={DollarSign} label="Total today" value={formatUsd(today)} />
        <SummaryCard
          icon={TrendingUp}
          label="Projected EOD"
          value={formatUsd(projected)}
          subtext="Based on 24h burn rate"
        />
        <SummaryCard
          icon={Wallet}
          label="Budget remaining"
          value={formatUsd(remaining)}
          subtext={
            status?.enabled
              ? `${formatUsd(today)} of ${formatUsd(budget)} used`
              : 'No budget configured'
          }
          tone={exceeded ? 'danger' : throttled ? 'warning' : 'default'}
        />
        <SummaryCard icon={Cpu} label="Top skill" value={topModel} subtext="By cumulative spend" />
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)]">Daily budget burn</span>
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
        {(overBudget || throttled || exceeded) && !dismissedAlert && (
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
                  {exceeded
                    ? `Daily budget exceeded (${formatUsd(today)} / ${formatUsd(budget)}).`
                    : throttled
                      ? 'Daily budget throttle reached: cloud-tier (T2) actions are paused.'
                      : `Projected EOD spend (${formatUsd(projected)}) exceeds your ${formatUsd(budget)} budget.`}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Increase the limit or reduce cloud-tier usage.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="budget-input" className="text-xs text-[var(--text-secondary)]">
                    Daily budget limit
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
                      value={budgetDraft}
                      disabled={!status?.enabled || saving}
                      onChange={(e) => setBudgetDraft(Number(e.target.value))}
                      className="h-8 w-24 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] pl-5 pr-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!status?.enabled || saving}
                    onClick={saveBudget}
                    className="rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {saveError && (
                    <span className="text-xs text-[var(--accent-danger)]">{saveError}</span>
                  )}
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
            <Coins className="h-3 w-3" /> {transactions.length} shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle-solid)]">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {typeof t.input?.prompt === 'string' ? t.input.prompt : t.type}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={t.tier as 0 | 1 | 2} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                    {formatUsd(t.costUsd ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                    No cost-bearing transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
