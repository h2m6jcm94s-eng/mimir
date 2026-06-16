'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Mail,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Star,
  Users,
} from 'lucide-react';
import { useState } from 'react';

type BriefingBase = {
  id: number;
  title: string;
  summary: string;
  tier: 0 | 1 | 2;
  confidence: number;
  when: string;
  pinned?: boolean;
};

type ImportantBriefing = BriefingBase & {
  kind: 'briefing';
  sources: number;
  actions: ('Email' | 'Meeting' | 'Task')[];
};

type EmailBriefing = BriefingBase & {
  kind: 'email';
  from: string;
  to: string;
  actions: ('Reply' | 'Forward' | 'Task')[];
};

type MeetingBriefing = BriefingBase & {
  kind: 'meeting';
  attendees: number;
  duration: string;
  actions: ('Join' | 'Agenda' | 'Decline')[];
};

type Briefing = ImportantBriefing | EmailBriefing | MeetingBriefing;

const briefings: Briefing[] = [
  {
    id: 1,
    kind: 'briefing',
    title: 'Daily Security Brief',
    summary: 'Three low-severity items flagged overnight; no active incidents.',
    sources: 8,
    tier: 0,
    confidence: 0.94,
    when: 'Today, 08:00',
    pinned: true,
    actions: ['Email', 'Meeting', 'Task'],
  },
  {
    id: 2,
    kind: 'briefing',
    title: 'Weekly Engineering Digest',
    summary: 'Dependency drift, two flaky tests, and a merged Temporal worker PR.',
    sources: 14,
    tier: 1,
    confidence: 0.89,
    when: 'Today, 07:30',
    actions: ['Email', 'Task'],
  },
  {
    id: 3,
    kind: 'briefing',
    title: 'Important: Clerk Key Rotation',
    summary: 'Signing key rotated successfully; verify downstream services.',
    sources: 3,
    tier: 2,
    confidence: 0.99,
    when: 'Yesterday',
    pinned: true,
    actions: ['Task'],
  },
  {
    id: 4,
    kind: 'email',
    title: 'Fwd: Q3 Budget Review',
    summary: 'Finance shared the Q3 draft; key variance is 12% over in cloud spend.',
    from: 'finance@example.com',
    to: 'you@mimir.local',
    tier: 1,
    confidence: 0.92,
    when: 'Today, 09:14',
    actions: ['Reply', 'Task'],
  },
  {
    id: 5,
    kind: 'meeting',
    title: 'Design Sync — Kimi/Hermes UI',
    summary: 'Review porting plan, token mapping, and component coverage.',
    attendees: 4,
    duration: '30 min',
    tier: 0,
    confidence: 0.98,
    when: 'Today, 14:00',
    actions: ['Join', 'Agenda'],
  },
  {
    id: 6,
    kind: 'meeting',
    title: 'Security Retro',
    summary: 'Post-incident review of last week’s dependency drift.',
    attendees: 6,
    duration: '60 min',
    tier: 2,
    confidence: 0.97,
    when: 'Tomorrow, 10:00',
    actions: ['Join', 'Agenda', 'Decline'],
  },
];

const actionIcons = {
  Email: Mail,
  Meeting: Calendar,
  Task: CheckSquare,
  Reply: Mail,
  Forward: Mail,
  Join: Calendar,
  Agenda: FileText,
  Decline: Users,
};

const kindIcons = {
  briefing: FileText,
  email: Mail,
  meeting: Users,
};

const filters = [
  { key: 'all', label: 'All' },
  { key: 'briefing', label: 'Important' },
  { key: 'email', label: 'Emails' },
  { key: 'meeting', label: 'Meetings' },
];

export default function BriefingsPage() {
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Briefing[]>(briefings);

  const visible = items
    .filter((b) => active === 'all' || b.kind === active)
    .filter(
      (b) =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.summary.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function togglePin(id: number) {
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, pinned: !b.pinned } : b)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Briefings"
        description="Your personal assistant view — important briefings, emails, and meetings."
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                active === f.key
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search briefings..."
            className="w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {visible.map((briefing, index) => {
            const KindIcon = kindIcons[briefing.kind];
            return (
              <motion.div
                key={briefing.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: index * 0.05, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="group flex flex-col rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                      <KindIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {briefing.title}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        {Math.round(briefing.confidence * 100)}% confidence · {briefing.when}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {briefing.pinned && <Pin className="h-3.5 w-3.5 text-[var(--accent-gold)]" />}
                    <button
                      type="button"
                      onClick={() => togglePin(briefing.id)}
                      aria-label={briefing.pinned ? 'Unpin briefing' : 'Pin briefing'}
                      className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-primary)] group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <TierBadge tier={briefing.tier} />
                  </div>
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {briefing.summary}
                </p>

                {briefing.kind === 'email' && (
                  <div className="mt-3 text-xs text-[var(--text-muted)]">
                    From {briefing.from} · To {briefing.to}
                  </div>
                )}
                {briefing.kind === 'meeting' && (
                  <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {briefing.attendees}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {briefing.duration}
                    </span>
                  </div>
                )}
                {briefing.kind === 'briefing' && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Star className="h-3 w-3 text-[var(--accent-gold)]" />
                    {briefing.sources} sources
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  {briefing.actions.map((action) => {
                    const Icon = actionIcons[action];
                    return (
                      <button
                        key={action}
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                          'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {action}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] py-12 text-center">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
            No briefings found
          </p>
          <p className="text-xs text-[var(--text-muted)]">Try a different filter or search term.</p>
        </div>
      )}
    </div>
  );
}
