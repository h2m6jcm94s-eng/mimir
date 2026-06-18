'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, Check, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type ItemStatus = 'pending' | 'done';

interface LifeAdminItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  recurrence: Recurrence;
  category: string | null;
  status: ItemStatus;
  tags: string[];
}

const recurrences: Recurrence[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const recurrenceLabel: Record<Recurrence, string> = {
  none: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date();
}

export default function LifeAdminPage() {
  const [items, setItems] = useState<LifeAdminItem[]>([]);
  const [status, setStatus] = useState<ItemStatus>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    recurrence: 'none' as Recurrence,
    category: '',
    tags: '',
  });

  const loadItems = useCallback(() => {
    setLoading(true);
    fetchJson<{ data: LifeAdminItem[] }>(`/api/v1/life-admin/upcoming?status=${status}&limit=50`)
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [items, query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.dueDate) return;

    const dueDate = new Date(form.dueDate);
    dueDate.setUTCHours(0, 0, 0, 0);

    fetchJson<LifeAdminItem>('/api/v1/life-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        dueDate: dueDate.toISOString(),
        recurrence: form.recurrence,
        category: form.category || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    })
      .then(() => {
        setForm({
          title: '',
          description: '',
          dueDate: '',
          recurrence: 'none',
          category: '',
          tags: '',
        });
        loadItems();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function markDone(id: string) {
    fetchJson<{ completed: LifeAdminItem; next?: LifeAdminItem }>(`/api/v1/life-admin/${id}/done`, {
      method: 'POST',
    })
      .then(() => loadItems())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Life admin"
        description="Track recurring responsibilities, deadlines, and household tasks."
      >
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('life-admin-form');
            el?.scrollIntoView({ behavior: 'smooth' });
            el?.querySelector('input')?.focus();
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New item
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <section
        id="life-admin-form"
        className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
      >
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Add a life admin item</h3>
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="life-admin-title"
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="life-admin-due-date"
          />
          <input
            type="text"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
            data-testid="life-admin-description"
          />
          <select
            value={form.recurrence}
            onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Recurrence }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="life-admin-recurrence"
          >
            {recurrences.map((r) => (
              <option key={r} value={r}>
                {recurrenceLabel[r]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="life-admin-category"
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
            data-testid="life-admin-tags"
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!form.title || !form.description || !form.dueDate}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['pending', 'done'] as ItemStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                status === s
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search items"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      <div className="space-y-3" data-testid="life-admin-list">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

        <AnimatePresence mode="popLayout">
          {filtered.map((item, index) => (
            <motion.div
              key={item.id}
              data-testid={`life-admin-card-${item.title}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h4>
                  {item.recurrence !== 'none' && (
                    <span className="rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      {recurrenceLabel[item.recurrence]}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                  {item.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span className={cn(isOverdue(item.dueDate) && 'text-[var(--text-danger)]')}>
                    Due {formatDate(item.dueDate)}
                  </span>
                  {item.category && <span>· {item.category}</span>}
                  {item.tags.length > 0 && (
                    <span className="flex gap-1">
                      ·
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              {item.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => markDone(item.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--accent-success)]/10 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/20'
                  )}
                  data-testid={`life-admin-done-${item.id}`}
                >
                  <Check className="h-3.5 w-3.5" /> Done
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No life admin items found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
