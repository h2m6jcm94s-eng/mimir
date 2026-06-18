'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  FileCode,
  GitCommit,
  Lock,
  MessageSquare,
  Route,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const demoPolicy = `rules:
  - action: github.openPr
    effect: require_approval
    reason: opening a PR requires human approval
  - action: '*'
    effect: deny
    when:
      tier: 2
      dailySpendUsd: '> 1.00'
    reason: daily cloud spend limit exceeded
  - action: '*'
    effect: allow
`;

interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  tier: number;
  hash: string;
}

function validatePolicy(yaml: string) {
  try {
    const hasRules = /^rules:/m.test(yaml);
    const noTabs = !/\t/.test(yaml);
    return hasRules && noTabs;
  } catch {
    return false;
  }
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function GovernancePage() {
  const [tab, setTab] = useState<'policy' | 'audit' | 'flow'>('policy');
  const [policy, setPolicy] = useState(demoPolicy);
  const [policyName, setPolicyName] = useState('default');
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [mode, setMode] = useState<'yaml' | 'natural'>('yaml');
  const [description, setDescription] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditVerified, setAuditVerified] = useState<boolean | null>(null);
  const valid = useMemo(() => validatePolicy(policy), [policy]);

  useEffect(() => {
    fetch('/api/v1/governance/policy', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.source) {
          setPolicy(data.data.source);
          setPolicyName(data.data.name ?? 'default');
        }
      })
      .catch(() => {
        // leave demo policy if API unavailable
      });
  }, []);

  useEffect(() => {
    if (tab !== 'audit') return;
    fetch('/api/v1/audit?limit=50', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          setAuditEvents(data.data as AuditEvent[]);
          setAuditVerified(data.verified ?? null);
        }
      })
      .catch(() => {
        setAuditEvents([]);
      });
  }, [tab]);

  async function savePolicy() {
    if (!valid) return;
    setLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/v1/governance/policy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: policyName, source: policy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error?.message || 'Failed to save policy');
      } else {
        setSaveSuccess(true);
        if (data.data?.source) {
          setPolicy(data.data.source);
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function translate() {
    if (!description.trim()) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch('/api/v1/governance/policy/translate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTranslateError(data.error?.message || 'Translation failed');
      } else if (data.data?.source) {
        setPolicy(data.data.source);
        setMode('yaml');
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Governance"
        description="Policy-as-code, immutable audit log, and privacy flow map."
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('policy')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'policy'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <FileCode className="h-3.5 w-3.5" /> Policy
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'audit'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <GitCommit className="h-3.5 w-3.5" /> Audit Log
        </button>
        <button
          type="button"
          onClick={() => setTab('flow')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'flow'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <Route className="h-3.5 w-3.5" /> Privacy Flow
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'policy' && (
          <motion.div
            key="policy"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('yaml')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  mode === 'yaml'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                )}
                data-testid="governance-mode-yaml"
              >
                <FileCode className="h-3.5 w-3.5" /> YAML
              </button>
              <button
                type="button"
                onClick={() => setMode('natural')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  mode === 'natural'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                )}
                data-testid="governance-mode-natural"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Natural language
              </button>
            </div>

            {mode === 'natural' && (
              <div className="space-y-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
                <p className="text-xs text-[var(--text-secondary)]">
                  Describe your policy in plain English. Mimir will convert it to YAML that you can
                  review before saving.
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Require approval for github.openPr. Deny tier 2 actions when daily spend is greater than 5.00. Allow everything else."
                  className="h-32 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="governance-natural-input"
                />
                {translateError && (
                  <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
                    {translateError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!description.trim() || translating}
                  onClick={translate}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    !description.trim() || translating
                      ? 'cursor-not-allowed bg-[var(--bg-primary)] text-[var(--text-muted)]'
                      : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                  )}
                  data-testid="governance-translate"
                >
                  {translating ? 'Translating…' : 'Translate to YAML'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {valid ? (
                <span
                  data-testid="policy-valid"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent-success)]"
                >
                  <Check className="h-3 w-3" /> Valid YAML
                </span>
              ) : (
                <span
                  data-testid="policy-invalid"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent-danger)]"
                >
                  <X className="h-3 w-3" /> Invalid
                </span>
              )}
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent-success)]">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              {saveError && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent-danger)]">
                  <X className="h-3 w-3" /> {saveError}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
              <button
                type="button"
                disabled={!valid || loading}
                onClick={savePolicy}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  !valid || loading
                    ? 'cursor-not-allowed bg-[var(--bg-primary)] text-[var(--text-muted)]'
                    : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                )}
              >
                {loading ? 'Saving…' : 'Save policy'}
              </button>
            </div>

            {mode === 'yaml' && (
              <textarea
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
                className="h-80 w-full rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 font-mono text-xs leading-relaxed shadow-card outline-none focus:border-[var(--border-focus)]"
                data-testid="governance-yaml-input"
              />
            )}
          </motion.div>
        )}

        {tab === 'audit' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-card"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-solid)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audit log</h3>
              <div className="flex items-center gap-2">
                {auditVerified === true && (
                  <span className="text-xs font-medium text-[var(--accent-success)]">Verified</span>
                )}
                {auditVerified === false && (
                  <span className="text-xs font-medium text-[var(--accent-danger)]">
                    Chain broken
                  </span>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                >
                  <Lock className="h-3 w-3" /> Verify chain
                </button>
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle-solid)]">
                {auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatTs(event.ts)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{event.actor}</td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{event.action}</td>
                    <td className="px-4 py-3">
                      <TierBadge tier={event.tier as 0 | 1 | 2} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-muted)]">{event.hash}</td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}

        {tab === 'flow' && (
          <motion.div
            key="flow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
          >
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--accent-warning)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Privacy flow map</h3>
            </div>
            <svg
              role="img"
              aria-label="Privacy flow diagram"
              viewBox="0 0 600 120"
              className="w-full"
            >
              <rect
                x="20"
                y="40"
                width="80"
                height="40"
                rx="8"
                className="fill-[var(--bg-primary)] stroke-[var(--border-subtle-solid)]"
              />
              <text
                x="60"
                y="65"
                textAnchor="middle"
                className="fill-[var(--text-secondary)] text-[10px]"
              >
                Input
              </text>

              <path
                d="M100 60 L160 60"
                className="stroke-[var(--text-muted)]"
                markerEnd="url(#arrow)"
              />

              <rect
                x="160"
                y="30"
                width="100"
                height="60"
                rx="8"
                className="fill-[var(--accent-primary)]/10 stroke-[var(--accent-primary)]"
              />
              <text
                x="210"
                y="55"
                textAnchor="middle"
                className="fill-[var(--accent-primary)] text-[10px] font-medium"
              >
                Classifier
              </text>
              <text
                x="210"
                y="72"
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-[8px]"
              >
                T0 / T1 / T2
              </text>

              <path
                d="M260 60 L320 60"
                className="stroke-[var(--text-muted)]"
                markerEnd="url(#arrow)"
              />

              <rect
                x="320"
                y="30"
                width="100"
                height="60"
                rx="8"
                className="fill-[var(--accent-teal)]/10 stroke-[var(--accent-teal)]"
              />
              <text
                x="370"
                y="55"
                textAnchor="middle"
                className="fill-[var(--accent-teal)] text-[10px] font-medium"
              >
                Policy
              </text>
              <text
                x="370"
                y="72"
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-[8px]"
              >
                allow / deny / approve
              </text>

              <path
                d="M420 55 L480 40"
                className="stroke-[var(--text-muted)]"
                markerEnd="url(#arrow)"
              />
              <path
                d="M420 65 L480 80"
                className="stroke-[var(--text-muted)]"
                markerEnd="url(#arrow)"
              />

              <rect
                x="480"
                y="15"
                width="90"
                height="40"
                rx="8"
                className="fill-[var(--accent-success)]/10 stroke-[var(--accent-success)]"
              />
              <text
                x="525"
                y="40"
                textAnchor="middle"
                className="fill-[var(--accent-success)] text-[10px] font-medium"
              >
                Execute
              </text>

              <rect
                x="480"
                y="70"
                width="90"
                height="40"
                rx="8"
                className="fill-[var(--accent-warning)]/10 stroke-[var(--accent-warning)]"
              />
              <text
                x="525"
                y="95"
                textAnchor="middle"
                className="fill-[var(--accent-warning)] text-[10px] font-medium"
              >
                Approval
              </text>

              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-[var(--text-muted)]" />
                </marker>
              </defs>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
