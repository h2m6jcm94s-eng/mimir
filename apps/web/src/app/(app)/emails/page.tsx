'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { Edit3, Mail, Plus } from 'lucide-react';

const emails = [
  {
    id: 1,
    subject: 'Weekly digest: security, dependencies, and releases',
    to: 'team@mimir.local',
    tone: 'professional',
    status: 'approved',
    tier: 1,
  },
  {
    id: 2,
    subject: 'Follow-up: Tailscale node patch plan',
    to: 'ops@mimir.local',
    tone: 'direct',
    status: 'pending',
    tier: 0,
  },
  {
    id: 3,
    subject: 'Vendor onboarding summary',
    to: 'external@example.com',
    tone: 'friendly',
    status: 'draft',
    tier: 2,
  },
];

const statusLabel: Record<string, string> = {
  approved: 'Human approved',
  pending: 'Pending review',
  draft: 'Draft',
};

const statusColor: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  draft: 'bg-slate-100 text-slate-700',
};

export default function EmailsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Emails" description="Generated, reviewed, and sent correspondence.">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Compose
        </button>
      </PageHeader>

      <div className="space-y-2">
        {emails.map((email) => (
          <div
            key={email.id}
            className="flex flex-col gap-3 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-all duration-200 hover:shadow-hover sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {email.subject}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  To: {email.to} · Tone: {email.tone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <TierBadge tier={email.tier as 0 | 1 | 2} />
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  statusColor[email.status]
                )}
              >
                {statusLabel[email.status]}
              </span>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
