'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Download, FileText, Search, ShieldCheck, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

type ReportKind = 'security' | 'cost' | 'compliance';
type ReportStatus = 'ready' | 'generating' | 'scheduled';

interface Report {
  id: string;
  title: string;
  description: string;
  kind: ReportKind;
  status: ReportStatus;
  date: string;
}

const reports: Report[] = [
  {
    id: 'security-audit',
    title: 'Security Audit',
    description: 'CVE scan, access review, and policy exceptions.',
    kind: 'security',
    status: 'ready',
    date: '2026-06-15',
  },
  {
    id: 'weekly-cost',
    title: 'Weekly Cost Report',
    description: 'Token spend by model, tier, and skill.',
    kind: 'cost',
    status: 'ready',
    date: '2026-06-14',
  },
  {
    id: 'compliance-q2',
    title: 'Q2 Compliance Summary',
    description: 'Governance log and privacy flow attestations.',
    kind: 'compliance',
    status: 'scheduled',
    date: '2026-06-30',
  },
  {
    id: 'mesh-health',
    title: 'Mesh Health Snapshot',
    description: 'Node uptime, latency, and queue depth.',
    kind: 'security',
    status: 'generating',
    date: 'Today',
  },
];

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

export default function ReportsPage() {
  const [active, setActive] = useState<ReportKind | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesKind = active === 'All' || r.kind === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      return matchesKind && matchesQuery;
    });
  }, [active, query]);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{report.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{report.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="capitalize">{kindLabel[report.kind]}</span>
                  <span>·</span>
                  <span>{report.date}</span>
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
    </div>
  );
}
