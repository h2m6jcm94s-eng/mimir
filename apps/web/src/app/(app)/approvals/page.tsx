'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Clock, Lock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ApprovalStatus = 'pending' | 'approved' | 'denied';

type ApprovalBlastRadius = {
  tier?: number;
  action?: string;
  scope?: string;
  estimatedCostUsd?: number;
  dataSubjects?: number;
  connectors?: string[];
  summary?: string;
};

interface Approval {
  id: string;
  jobId: string;
  status: ApprovalStatus;
  risk: 'low' | 'medium' | 'high';
  blastRadius: ApprovalBlastRadius;
  requestedBy: string;
  decidedBy?: string;
  reason?: string;
  expiresAt?: string;
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

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'approved' | 'denied' | null>(null);
  const [pin, setPin] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

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

  function startDecide(id: string, decision: 'approved' | 'denied') {
    setDecidingId(id);
    setDecisionType(decision);
    setPin('');
    setDecisionReason('');
    setError(null);
  }

  function cancelDecide() {
    setDecidingId(null);
    setDecisionType(null);
    setPin('');
    setDecisionReason('');
  }

  async function confirmDecide(id: string) {
    if (!decisionType) return;
    if (!pin) {
      setError('Enter your PIN to confirm.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = decisionType === 'approved' ? 'approve' : 'deny';
      const res = await fetch(`/api/v1/approvals/${id}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: decisionReason || undefined, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message || `Failed to ${decisionType} approval`);
      } else {
        cancelDecide();
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
        {visible.map((approval) => {
          const expired = isExpired(approval.expiresAt);
          const deciding = decidingId === approval.id;
          return (
            <div
              key={approval.id}
              data-testid={`approval-${approval.id}`}
              className="rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:shadow-hover"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      Job {approval.jobId.slice(0, 8)}
                    </h3>
                    {approval.blastRadius?.tier !== undefined && (
                      <TierBadge tier={approval.blastRadius.tier as 0 | 1 | 2} />
                    )}
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
                    <span
                      className={cn(
                        'rounded-lg px-2 py-0.5 text-[10px] font-medium capitalize',
                        approval.risk === 'high' &&
                          'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]',
                        approval.risk === 'medium' &&
                          'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]',
                        approval.risk === 'low' &&
                          'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                      )}
                    >
                      {approval.risk} risk
                    </span>
                  </div>

                  {approval.blastRadius && (
                    <div
                      data-testid="blast-radius"
                      className="rounded-lg bg-[var(--bg-surface-raised)] p-3 text-xs"
                    >
                      <p className="mb-1.5 font-medium text-[var(--text-primary)]">Blast radius</p>
                      <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)] sm:grid-cols-3">
                        {approval.blastRadius.action && (
                          <div>
                            <span className="text-[var(--text-muted)]">Action:</span>{' '}
                            {approval.blastRadius.action}
                          </div>
                        )}
                        {approval.blastRadius.connectors &&
                          approval.blastRadius.connectors.length > 0 && (
                            <div>
                              <span className="text-[var(--text-muted)]">Connectors:</span>{' '}
                              {approval.blastRadius.connectors.join(', ')}
                            </div>
                          )}
                        {typeof approval.blastRadius.estimatedCostUsd === 'number' && (
                          <div>
                            <span className="text-[var(--text-muted)]">Est. cost:</span> $
                            {approval.blastRadius.estimatedCostUsd.toFixed(2)}
                          </div>
                        )}
                        {typeof approval.blastRadius.dataSubjects === 'number' && (
                          <div>
                            <span className="text-[var(--text-muted)]">Data subjects:</span>{' '}
                            {approval.blastRadius.dataSubjects}
                          </div>
                        )}
                        {approval.blastRadius.scope && (
                          <div className="col-span-full">
                            <span className="text-[var(--text-muted)]">Scope:</span>{' '}
                            {approval.blastRadius.scope}
                          </div>
                        )}
                        {approval.blastRadius.summary && (
                          <div className="col-span-full">
                            <span className="text-[var(--text-muted)]">Summary:</span>{' '}
                            {approval.blastRadius.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {approval.reason && (
                    <p className="text-sm text-[var(--text-secondary)]">{approval.reason}</p>
                  )}
                  <p className="text-xs text-[var(--text-muted)]">
                    Requested by {approval.requestedBy} · {formatTs(approval.createdAt)}
                    {approval.expiresAt && (
                      <>
                        {' · '}
                        <span className={cn(expired && 'text-[var(--accent-danger)]')}>
                          {expired ? 'Expired' : `Expires ${formatTs(approval.expiresAt)}`}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {approval.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={loading || expired}
                        onClick={() => startDecide(approval.id, 'approved')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-success)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-success)] transition-colors hover:bg-[var(--accent-success)]/20 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading || expired}
                        onClick={() => startDecide(approval.id, 'denied')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-danger)] transition-colors hover:bg-[var(--accent-danger)]/20 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Deny
                      </button>
                    </div>
                    {expired && (
                      <div className="flex items-center gap-1 text-[10px] text-[var(--accent-danger)]">
                        <AlertTriangle className="h-3 w-3" />
                        This approval has expired.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {deciding && (
                <div className="mt-4 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface-raised)] p-4">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Enter PIN to {decisionType === 'approved' ? 'approve' : 'deny'}
                    <div className="mt-2 flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <input
                        data-testid="approval-pin-input"
                        type="password"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="••••"
                        className="w-32 rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </label>
                  <label className="mt-3 block text-xs font-medium text-[var(--text-secondary)]">
                    Reason (optional)
                    <textarea
                      data-testid="approval-reason-input"
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      rows={2}
                      className="mt-2 block w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                    />
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => confirmDecide(approval.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                    >
                      Confirm {decisionType === 'approved' ? 'Approval' : 'Denial'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={cancelDecide}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
