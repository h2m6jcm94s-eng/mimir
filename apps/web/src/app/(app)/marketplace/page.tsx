'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Cloud,
  Download,
  Filter,
  Mail,
  MessageSquare,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type ListingKind = 'skill' | 'connector' | 'workflow';
type ListingTier = 0 | 1 | 2;

interface Listing {
  id: string;
  name: string;
  description: string;
  kind: ListingKind;
  tier: ListingTier;
  installs: number;
  installed: boolean;
  icon: React.ElementType;
}

const listings: Listing[] = [
  {
    id: 'meeting-notes-pro',
    name: 'Meeting Notes Pro',
    description: 'Auto-extract action items, decisions, and owners from any transcript.',
    kind: 'skill',
    tier: 0,
    installs: 1240,
    installed: false,
    icon: MessageSquare,
  },
  {
    id: 'gmail-connector',
    name: 'Gmail Connector',
    description: 'Read, draft, and send email with tier-aware classification.',
    kind: 'connector',
    tier: 2,
    installs: 893,
    installed: true,
    icon: Mail,
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Daily CVE and secret-leak scan across your knowledge base.',
    kind: 'workflow',
    tier: 0,
    installs: 2100,
    installed: false,
    icon: ShieldCheck,
  },
  {
    id: 'figma-connector',
    name: 'Figma Connector',
    description: 'Pull comments and inspect design files.',
    kind: 'connector',
    tier: 2,
    installs: 456,
    installed: false,
    icon: Palette,
  },
  {
    id: 'terminal-copilot',
    name: 'Terminal Copilot',
    description: 'Translate plain-language tasks into safe shell commands.',
    kind: 'skill',
    tier: 1,
    installs: 1543,
    installed: false,
    icon: Terminal,
  },
  {
    id: 'cloud-render',
    name: 'Cloud Render',
    description: 'Offload heavy renders to an air-gapped cloud worker.',
    kind: 'workflow',
    tier: 2,
    installs: 312,
    installed: false,
    icon: Cloud,
  },
];

const filters: Array<ListingKind | 'All'> = ['All', 'skill', 'connector', 'workflow'];

const kindLabel: Record<ListingKind, string> = {
  skill: 'Skill',
  connector: 'Connector',
  workflow: 'Workflow',
};

const tierLabel: Record<ListingTier, string> = {
  0: 'Private',
  1: 'Local',
  2: 'Cloud',
};

export default function MarketplacePage() {
  const [items, setItems] = useState<Listing[]>(listings);
  const [active, setActive] = useState<ListingKind | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesKind = active === 'All' || item.kind === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      return matchesKind && matchesQuery;
    });
  }, [items, active, query]);

  function toggleInstall(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, installed: !item.installed } : item))
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Skills, connectors, and workflows from the Mimir community."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                active === f
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              <Filter className="h-3 w-3" /> {f}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search marketplace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                layout
                data-testid={`listing-${item.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-shadow hover:shadow-hover"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5">
                    {kindLabel[item.kind]}
                  </span>
                  <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5">
                    {tierLabel[item.tier]}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" /> {item.installs.toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="listing-install"
                    onClick={() => toggleInstall(item.id)}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                      item.installed
                        ? 'border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                        : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                    )}
                  >
                    {item.installed ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Installed
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Install
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="rounded-xl bg-[var(--bg-surface)] p-8 text-center shadow-card">
          <p className="text-sm text-[var(--text-secondary)]">No listings match your filters.</p>
        </div>
      )}
    </div>
  );
}
