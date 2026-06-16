'use client';

import { ModelBadge } from '@/components/ui/ModelBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckSquare,
  Clock,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
  Square,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'snoozed' | 'delegated';

interface Approval {
  id: number;
  title: string;
  description: string;
  blastRadius: string;
  tier: 0 | 1 | 2;
  models: { name: 'kimi' | 'claude' | 'ollama'; confidence: number }[];
  expiresAt: number;
  status: ApprovalStatus;
  destructive: boolean;
}

const initialApprovals: Approval[] = [
  {
    id: 1,
    title: 'Deploy worker + restart RAG service',
    description: 'Push the new worker build to cloud and restart the RAG service.',
    blastRadius: 'Deploys 1 service · Restarts 1 service · ~12 users affected',
    tier: 2,
    models: [
      { name: 'kimi', confidence: 0.94 },
      { name: 'claude', confidence: 0.91 },
    ],
    expiresAt: Date.now() + 15 * 60 * 1000,
    status: 'pending',
    destructive: true,
  },
  {
    id: 2,
    title: 'Send weekly digest email',
    description: 'Draft and send the weekly engineering digest.',
    blastRadius: '12 recipients · 0 services affected',
    tier: 2,
    models: [{ name: 'claude', confidence: 0.87 }],
    expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    status: 'pending',
    destructive: false,
  },
  {
    id: 3,
    title: 'Apply Tailscale node patch',
    description: 'Patch a single relay node.',
    blastRadius: '1 node · 4 users affected',
    tier: 1,
    models: [{ name: 'kimi', confidence: 0.91 }],
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    status: 'pending',
    destructive: false,
  },
];

const tabs: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'delegated', label: 'Delegated' },
  { key: 'approved', label: 'History' },
];

function formatRemaining(ms: number) {
  if (ms <= 0) return 'queued for review';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(expiresAt - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(expiresAt - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
      <Clock className="h-3 w-3" />
      {formatRemaining(remaining)}
    </span>
  );
}

function PinGate({
  open,
  title,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');

  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-[100] m-0 flex h-screen w-screen items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] p-5 shadow-xl">
        <div className="flex items-center gap-2 text-[var(--accent-warning)]">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Destructive action</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Approve <span className="font-medium text-[var(--text-primary)]">{title}</span>? Enter PIN
          to confirm.
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••••"
          className="mt-4 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-[var(--border-focus)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pin.length < 4}
            onClick={() => {
              setPin('');
              onConfirm();
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors',
              pin.length < 4
                ? 'cursor-not-allowed bg-[var(--text-muted)]'
                : 'bg-[var(--accent-success)] hover:bg-[var(--accent-success)]/90'
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'all'>('pending');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pinGateId, setPinGateId] = useState<number | null>(null);

  const historyStatuses: ApprovalStatus[] = ['approved', 'denied', 'snoozed', 'delegated'];
  const visible = useMemo(
    () =>
      approvals.filter((a) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'approved') return historyStatuses.includes(a.status);
        return a.status === activeTab;
      }),
    [approvals, activeTab]
  );

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  function updateStatus(id: number, status: ApprovalStatus) {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleApprove(id: number) {
    const approval = approvals.find((a) => a.id === id);
    if (approval?.destructive) {
      setPinGateId(id);
      return;
    }
    updateStatus(id, 'approved');
  }

  function confirmPinGate() {
    if (pinGateId !== null) updateStatus(pinGateId, 'approved');
    setPinGateId(null);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function batchApprove() {
    setApprovals((prev) =>
      prev.map((a) =>
        selected.has(a.id) && a.status === 'pending' ? { ...a, status: 'approved' } : a
      )
    );
    setSelected(new Set());
  }

  function batchDeny() {
    setApprovals((prev) =>
      prev.map((a) =>
        selected.has(a.id) && a.status === 'pending' ? { ...a, status: 'denied' } : a
      )
    );
    setSelected(new Set());
  }

  const allSelected = visible.length > 0 && visible.every((a) => selected.has(a.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop decisions before sensitive actions."
      >
        <button
          type="button"
          onClick={() => {
            setBatchMode((v) => !v);
            setSelected(new Set());
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            batchMode
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {batchMode ? 'Done' : 'Batch'}
        </button>
      </PageHeader>

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

        {batchMode && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">{selected.size} selected</span>
            <button
              type="button"
              aria-label="Batch approve"
              onClick={batchApprove}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-success)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--accent-success)] transition-colors hover:bg-[var(--accent-success)]/20"
            >
              <Check className="h-3 w-3" /> Approve
            </button>
            <button
              type="button"
              onClick={batchDeny}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-danger)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--accent-danger)] transition-colors hover:bg-[var(--accent-danger)]/20"
            >
              <X className="h-3 w-3" /> Deny
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visible.map((approval) => {
            const agreement = approval.models.length > 1;
            return (
              <motion.div
                key={approval.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                data-testid={`approval-${approval.id}`}
                className="rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:shadow-hover"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {batchMode && (
                        <button
                          type="button"
                          onClick={() => toggleSelect(approval.id)}
                          aria-label={selected.has(approval.id) ? 'Deselect' : 'Select'}
                          className="text-[var(--accent-primary)]"
                        >
                          {selected.has(approval.id) ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {approval.title}
                      </h3>
                      <TierBadge tier={approval.tier} />
                      {approval.destructive && (
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-danger)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-danger)]">
                          <ShieldAlert className="h-3 w-3" /> PIN required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{approval.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">{approval.blastRadius}</p>

                    <div className="flex flex-wrap items-center gap-3">
                      {approval.models.map((m) => (
                        <ModelBadge key={m.name} model={m.name} />
                      ))}
                      {agreement ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-success)]">
                          <Check className="h-3 w-3" /> Models agree
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--text-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                          Single model
                        </span>
                      )}
                      <Countdown expiresAt={approval.expiresAt} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {approval.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(approval.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                            'bg-[var(--accent-success)]/10 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/20'
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(approval.id, 'approved')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Approve with note
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(approval.id, 'snoozed')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Snooze 1h
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(approval.id, 'delegated')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Delegate
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(approval.id, 'denied')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-danger)] transition-colors hover:bg-[var(--accent-danger)]/20"
                        >
                          <X className="h-3.5 w-3.5" />
                          Deny
                        </button>
                      </>
                    )}
                    {approval.status !== 'pending' && (
                      <span
                        className={cn(
                          'rounded-lg px-3 py-2 text-xs font-medium capitalize',
                          approval.status === 'approved'
                            ? 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                            : approval.status === 'denied'
                              ? 'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]'
                              : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                        )}
                      >
                        {approval.status}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="More options"
                      className="rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] py-12 text-center">
          <Check className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No approvals here</p>
          <p className="text-xs text-[var(--text-muted)]">All caught up.</p>
        </div>
      )}

      <PinGate
        open={pinGateId !== null}
        title={approvals.find((a) => a.id === pinGateId)?.title ?? ''}
        onConfirm={confirmPinGate}
        onCancel={() => setPinGateId(null)}
      />
    </div>
  );
}
