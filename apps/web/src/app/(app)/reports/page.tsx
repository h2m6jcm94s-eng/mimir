'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Report as ReportType } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Clock,
  Download,
  FileText,
  Search,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ReportKind = ReportType['kind'];
type ReportStatus = ReportType['status'];

interface CeoReport {
  usageInsights: {
    tasksCompleted: number;
    timeSavedMinutes: number;
    automationRate: number;
  };
}

const filters: Array<ReportKind | 'All'> = ['All', 'security', 'cost', 'compliance'];

const kindIcon: Record<ReportKind, React.ElementType> = {
  security: ShieldCheck,
  cost: Wallet,
  compliance: FileText,
};

const kindLabel: Record<ReportKind, string> = {
  security: 'Security',
  cost: 'Cost',
  compliance: 'Compliance',
};

const statusBadge: Record<ReportStatus, string> = {
  ready: 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]',
  generating: 'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]',
  scheduled: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

function InsightCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 shadow-card">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const [active, setActive] = useState<ReportKind | 'All'>('All');
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<ReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<CeoReport['usageInsights'] | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJson<{ data: ReportType[] }>('/api/v1/reports?limit=50'),
      fetchJson<CeoReport>('/api/v1/reports/ceo'),
    ])
      .then(([reportsBody, ceoBody]) => {
        setReports(reportsBody.data);
        setInsights(ceoBody.usageInsights);
        setError(null);
        setInsightsError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesKind = active === 'All' || r.kind === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      return matchesKind && matchesQuery;
    });
  }, [active, query, reports]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generated documents, audit summaries, and recurring analytics."
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" /> New report
        </button>
      </PageHeader>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Usage insights</h2>
        {insightsError && <p className="text-xs text-[var(--text-danger)]">{insightsError}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <InsightCard
            icon={Zap}
            label="Tasks completed"
            value={insights ? String(insights.tasksCompleted) : '—'}
            sub="Automated by Mimir"
          />
          <InsightCard
            icon={Clock}
            label="Time saved"
            value={insights ? formatMinutes(insights.timeSavedMinutes) : '—'}
            sub="Estimated this period"
          />
          <InsightCard
            icon={BarChart3}
            label="Automation rate"
            value={insights ? `${(insights.automationRate * 100).toFixed(0)}%` : '—'}
            sub="Done vs total tasks"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" data-testid="report-filters">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                active === f
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search reports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-muted)]">Loading reports…</div>
      ) : (
        <>
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((report) => {
                const Icon = kindIcon[report.kind];
                return (
                  <motion.div
                    key={report.id}
                    layout
                    data-testid={`report-${report.id}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-shadow hover:shadow-hover"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {report.title}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {report.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="capitalize">{kindLabel[report.kind]}</span>
                      <span>·</span>
                      <span>{formatDate(report.createdAt)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        data-testid="report-status"
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                          statusBadge[report.status]
                        )}
                      >
                        {report.status}
                      </span>
                      <button
                        type="button"
                        disabled={report.status !== 'ready'}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                          report.status === 'ready'
                            ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                            : 'cursor-not-allowed bg-[var(--bg-primary)] text-[var(--text-muted)]'
                        )}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <div className="rounded-xl bg-[var(--bg-surface)] p-8 text-center shadow-card">
              <p className="text-sm text-[var(--text-secondary)]">No reports match your filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
