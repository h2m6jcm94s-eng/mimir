'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

type ShareStatus = 'pending' | 'approved' | 'denied' | 'revoked' | 'expired';

interface KnowledgeShare {
  id: string;
  providerTenantId: string;
  requesterTenantId: string;
  knowledgeItemId: string;
  status: ShareStatus;
  scope: 'search' | 'read';
  tier: 0 | 1 | 2;
  requestedByUserAccountId: string;
  reviewedByUserAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

const tabs = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
];

function StatusBadge({ status }: { status: ShareStatus }) {
  const styles: Record<ShareStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    denied: 'bg-rose-100 text-rose-800',
    revoked: 'bg-slate-100 text-slate-800',
    expired: 'bg-slate-100 text-slate-800',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

export default function KnowledgeRequestsPage() {
  const [active, setActive] = useState<'incoming' | 'outgoing'>('incoming');
  const [shares, setShares] = useState<KnowledgeShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/knowledge/shares?direction=${active}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setShares(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  async function act(id: string, action: 'approve' | 'deny' | 'revoke') {
    try {
      const res = await fetch(`/api/v1/knowledge/shares/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `HTTP ${res.status}`);
      }
      await loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shared knowledge"
        description="Approve or manage cross-mesh knowledge share requests."
      />

      <div className="flex items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key as 'incoming' | 'outgoing')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              active === t.key
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--text-muted)]">Loading…</div>
      ) : shares.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">No share requests</p>
          <p className="text-xs text-[var(--text-muted)]">
            {active === 'incoming'
              ? 'Other meshes have not requested access to your knowledge yet.'
              : 'You have not requested knowledge from other meshes yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Knowledge item
                  </span>
                  <code className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {share.knowledgeItemId.slice(0, 8)}…
                  </code>
                  <StatusBadge status={share.status} />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {active === 'incoming'
                    ? `Requested by tenant ${share.requesterTenantId.slice(0, 8)}…`
                    : `Provider tenant ${share.providerTenantId.slice(0, 8)}…`}
                  {' · '}
                  {share.scope} · <TierBadge tier={share.tier} />
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Updated {new Date(share.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {active === 'incoming' && share.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => act(share.id, 'approve')}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => act(share.id, 'deny')}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                    >
                      Deny
                    </button>
                  </>
                )}
                {share.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => act(share.id, 'revoke')}
                    className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
