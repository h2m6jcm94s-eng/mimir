'use client';

import { ModelBadge } from '@/components/ui/ModelBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Image, Plus, Search, Upload, X } from 'lucide-react';
import { useState } from 'react';

type KnowledgeKind = 'document' | 'screenshot';

interface KnowledgeItem {
  id: number;
  title: string;
  kind: KnowledgeKind;
  tier: 0 | 1 | 2;
  model: 'kimi' | 'claude' | 'ollama';
  sources: number;
  updated: string;
  description?: string;
  ocr?: string;
}

const items: KnowledgeItem[] = [
  {
    id: 1,
    title: 'Security runbook',
    kind: 'document',
    tier: 0,
    model: 'kimi',
    sources: 4,
    updated: '2h ago',
    description: 'Incident response procedures and contacts.',
  },
  {
    id: 2,
    title: 'Q3 budget draft',
    kind: 'document',
    tier: 1,
    model: 'claude',
    sources: 1,
    updated: '1d ago',
    description: 'Finance shared draft with cloud spend variance.',
  },
  {
    id: 3,
    title: 'Screenshot: billing page',
    kind: 'screenshot',
    tier: 2,
    model: 'ollama',
    sources: 1,
    updated: '3d ago',
    ocr: 'Total: $142.50 · Invoice #9921',
  },
  {
    id: 4,
    title: 'Architecture diagram',
    kind: 'screenshot',
    tier: 0,
    model: 'kimi',
    sources: 2,
    updated: '5d ago',
    ocr: 'Mesh topology v2',
  },
  {
    id: 5,
    title: 'Clerk rotation log',
    kind: 'document',
    tier: 0,
    model: 'kimi',
    sources: 2,
    updated: 'Yesterday',
    description: 'Signing key rotation verification steps.',
  },
  {
    id: 6,
    title: 'Screenshot: error modal',
    kind: 'screenshot',
    tier: 1,
    model: 'claude',
    sources: 1,
    updated: '1w ago',
    ocr: 'Error 502: upstream timeout',
  },
];

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'document', label: 'Documents' },
  { key: 'screenshot', label: 'Screenshots' },
];

function ItemCard({
  item,
  index,
  onOpen,
}: { item: KnowledgeItem; index: number; onOpen: (item: KnowledgeItem) => void }) {
  const isScreenshot = item.kind === 'screenshot';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={() => onOpen(item)}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        isScreenshot && 'row-span-2'
      )}
    >
      {isScreenshot ? (
        <div className="flex h-40 items-center justify-center bg-[var(--bg-surface-raised)]">
          <Image className="h-10 w-10 text-[var(--text-muted)]" />
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center bg-[var(--accent-primary)]/5">
          <FileText className="h-10 w-10 text-[var(--accent-primary)]" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h4>
          <TierBadge tier={item.tier} />
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
          {item.description || item.ocr}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <ModelBadge model={item.model} />
          <span className="text-[10px] text-[var(--text-muted)]">
            {item.sources} sources · {item.updated}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function Lightbox({ item, onClose }: { item: KnowledgeItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <dialog
      open
      className="fixed inset-0 z-[100] m-0 flex h-screen w-screen items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {item.sources} sources · {item.updated}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-[var(--bg-surface-raised)]">
          {item.kind === 'screenshot' ? (
            <Image className="h-16 w-16 text-[var(--text-muted)]" />
          ) : (
            <FileText className="h-16 w-16 text-[var(--accent-primary)]" />
          )}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <TierBadge tier={item.tier} />
            <ModelBadge model={item.model} />
          </div>
          {item.kind === 'document' && (
            <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
          )}
          {item.kind === 'screenshot' && item.ocr && (
            <div className="rounded-lg bg-[var(--bg-primary)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">OCR</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.ocr}</p>
            </div>
          )}
        </div>
      </motion.div>
    </dialog>
  );
}

export default function KnowledgePage() {
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);

  const filtered = items
    .filter((i) => active === 'all' || i.kind === active)
    .filter(
      (i) =>
        i.title.toLowerCase().includes(query.toLowerCase()) ||
        (i.description || '').toLowerCase().includes(query.toLowerCase()) ||
        (i.ocr || '').toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge"
        description="Documents and screenshots that ground Mimir’s answers."
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Ingest
        </button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-6 text-center">
        <Upload className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
          Drop files or screenshots here
        </p>
        <p className="text-xs text-[var(--text-muted)]">PDF, Markdown, PNG, JPG</p>
      </div>

      <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.map((item, index) => (
            <ItemCard key={item.id} item={item} index={index} onOpen={setSelected} />
          ))}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center text-sm text-[var(--text-muted)]">
          No knowledge items found.
        </div>
      )}

      <AnimatePresence>
        {selected && <Lightbox item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
