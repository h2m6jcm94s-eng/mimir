'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { Check, Clock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ApprovalStatus = 'pending' | 'approved' | 'denied';

interface Approval {
  id: string;
  jobId: string;
  status: ApprovalStatus;
  requestedBy: string;
  decidedBy?: string;
  reason?: string;
  createdAt: string;
  tier?: number;
}

const tabs: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
];

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/approvals', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message || 'Failed to load approvals');
      } else {
        setApprovals((data.data as Approval[]) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  async function decide(id: string, decision: 'approved' | 'denied') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/approvals/${id}/${decision}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message || `Failed to ${decision} approval`);
      } else {
        await loadApprovals();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(
    () =>
      approvals.filter((a) => {
        if (activeTab === 'all') return true;
        return a.status === activeTab;
      }),
    [approvals, activeTab]
  );

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop decisions before sensitive actions."
      />

      {error && (
        <div className="rounded-lg bg-[var(--accent-danger)]/10 px-4 py-2 text-xs text-[var(--accent-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadApprovals}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
        >
          <Clock className="h-3.5 w-3.5" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3">
        {visible.map((approval) => (
          <div
            key={approval.id}
            className="rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:shadow-hover"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Job {approval.jobId.slice(0, 8)}
                  </h3>
                  {approval.tier !== undefined && <TierBadge tier={approval.tier as 0 | 1 | 2} />}
                  <span
                    className={cn(
                      'rounded-lg px-2 py-0.5 text-[10px] font-medium capitalize',
                      approval.status === 'pending' &&
                        'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]',
                      approval.status === 'approved' &&
                        'bg-[var(--accent-success)]/10 text-[var(--accent-success)]',
                      approval.status === 'denied' &&
                        'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]'
                    )}
                  >
                    {approval.status}
                  </span>
                </div>
                {approval.reason && (
                  <p className="text-sm text-[var(--text-secondary)]">{approval.reason}</p>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  Requested by {approval.requestedBy} · {formatTs(approval.createdAt)}
                </p>
              </div>

              {approval.status === 'pending' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => decide(approval.id, 'approved')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-success)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-success)] transition-colors hover:bg-[var(--accent-success)]/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => decide(approval.id, 'denied')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-danger)] transition-colors hover:bg-[var(--accent-danger)]/20"
                  >
                    <X className="h-3.5 w-3.5" />
                    Deny
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] py-12 text-center">
          <Check className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No approvals here</p>
          <p className="text-xs text-[var(--text-muted)]">All caught up.</p>
        </div>
      )}
    </div>
  );
}
