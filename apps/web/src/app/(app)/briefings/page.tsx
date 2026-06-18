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
  RefreshCw,
  Search,
  Star,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type BriefingBase = {
  id: string;
  title: string;
  summary: string;
  tier: 0 | 1 | 2;
  confidence: number;
  when: string;
  pinned?: boolean;
};

type ImportantBriefing = BriefingBase & {
  kind: 'briefing';
  sources?: number | null;
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.headers ?? {}),
      ...(options?.body && { 'content-type': 'application/json' }),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatWhen(date: string): string {
  const d = new Date(date);
  return d.toLocaleString();
}

function mapApiToBriefing(row: Record<string, unknown>): Briefing {
  const base: BriefingBase = {
    id: row.id as string,
    title: (row.title as string) ?? 'Untitled',
    summary: (row.summary as string) ?? '',
    tier: (row.tier as 0 | 1 | 2) ?? 1,
    confidence: (row.confidence as number) ?? 0.9,
    when: formatWhen(row.createdAt as string),
    pinned: row.pinned === 'pinned',
  };

  const kind = row.kind as 'briefing' | 'email' | 'meeting';
  const payload = (row.payload as Record<string, unknown>) ?? {};

  if (kind === 'email') {
    return {
      ...base,
      kind: 'email',
      from: (payload.from as string) ?? 'unknown',
      to: (payload.to as string) ?? 'you',
      actions: ['Reply', 'Task'],
    };
  }

  if (kind === 'meeting') {
    return {
      ...base,
      kind: 'meeting',
      attendees: (payload.attendees as number) ?? 1,
      duration: (payload.duration as string) ?? '15 min',
      actions: ['Join', 'Agenda'],
    };
  }

  return {
    ...base,
    kind: 'briefing',
    sources: (row.sources as number) ?? undefined,
    actions: ['Email', 'Task'],
  };
}

export default function BriefingsPage() {
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const response = await fetchJson<{ data: Record<string, unknown>[] }>(
        '/api/v1/briefings?limit=50'
      );
      setItems(response.data.map(mapApiToBriefing));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    try {
      setLoading(true);
      await fetchJson('/api/v1/briefings/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only on mount to avoid re-fetch loops
  useEffect(() => {
    load();
  }, []);

  const visible = items
    .filter((b) => active === 'all' || b.kind === active)
    .filter(
      (b) =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.summary.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function togglePin(id: string) {
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
          onClick={generate}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
          )}
        >
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Generate
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
          {error}
        </div>
      )}

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
                    {briefing.sources ?? 0} sources
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

      {!loading && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] py-12 text-center">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
            No briefings found
          </p>
          <p className="text-xs text-[var(--text-muted)]">Try generating a new briefing.</p>
        </div>
      )}
    </div>
  );
}
