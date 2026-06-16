'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileCode, GitCommit, Lock, Route, ShieldAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';

const defaultPolicy = `classification:
  - pattern: "\\bpassword\\b|\\bsecret\\b"
    tier: 0
  - pattern: "\\bcredit card\\b"
    tier: 0

approval:
  destructive:
    tier: 2
    requires_pin: true
`;

const auditEvents = [
  {
    id: 1,
    time: '2026-06-16 10:28',
    actor: 'system',
    action: 'policy loaded',
    tier: 0,
    hash: 'a1b2c3',
  },
  {
    id: 2,
    time: '2026-06-16 10:29',
    actor: 'user@local',
    action: 'approved deployment',
    tier: 2,
    hash: 'd4e5f6',
  },
  {
    id: 3,
    time: '2026-06-16 10:30',
    actor: 'system',
    action: 'key rotation completed',
    tier: 0,
    hash: 'g7h8i9',
  },
];

function validatePolicy(yaml: string) {
  try {
    const hasClassification = /^classification:/m.test(yaml);
    const hasApproval = /^approval:/m.test(yaml);
    const noTabs = !/\t/.test(yaml);
    return hasClassification && hasApproval && noTabs;
  } catch {
    return false;
  }
}

export default function GovernancePage() {
  const [tab, setTab] = useState<'policy' | 'audit' | 'flow'>('policy');
  const [policy, setPolicy] = useState(defaultPolicy);
  const valid = useMemo(() => validatePolicy(policy), [policy]);

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
            </div>
            <textarea
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="h-80 w-full rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 font-mono text-xs leading-relaxed shadow-card outline-none focus:border-[var(--border-focus)]"
            />
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
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
              >
                <Lock className="h-3 w-3" /> Verify chain
              </button>
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
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{event.time}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{event.actor}</td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{event.action}</td>
                    <td className="px-4 py-3">
                      <TierBadge tier={event.tier as 0 | 1 | 2} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-muted)]">{event.hash}</td>
                  </tr>
                ))}
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
                Router
              </text>
              <text
                x="370"
                y="72"
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-[8px]"
              >
                node + model
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
                Local node
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
                Cloud node
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
