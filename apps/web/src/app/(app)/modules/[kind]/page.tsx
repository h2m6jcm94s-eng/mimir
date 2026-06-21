'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { type ModuleConfig, type PersonalModuleKind, moduleConfigs } from '@/lib/module-config';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ModuleItem {
  id: string;
  kind: PersonalModuleKind;
  title: string;
  description: string | null;
  status: 'active' | 'done' | 'archived';
  dueAt: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function useModuleKind(): PersonalModuleKind | null {
  const params = useParams();
  const kind = params.kind;
  if (typeof kind !== 'string') return null;
  if (kind in moduleConfigs) return kind as PersonalModuleKind;
  return null;
}

function buildPayload(
  config: ModuleConfig,
  values: Record<string, string>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const value = values[field.key];
    if (value === undefined || value === '') continue;
    if (field.type === 'number') {
      const num = Number(value);
      if (!Number.isNaN(num)) payload[field.key] = num;
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

export default function PersonalModulePage() {
  const kind = useModuleKind();
  const config = kind ? moduleConfigs[kind] : undefined;

  const [items, setItems] = useState<ModuleItem[]>([]);
  const [status, setStatus] = useState<ModuleItem['status']>('active');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const loadItems = useCallback(() => {
    if (!kind) return;
    setLoading(true);
    fetchJson<{ data: ModuleItem[] }>(
      `/api/v1/personal-modules?kind=${kind}&status=${status}&limit=100`
    )
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [kind, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        JSON.stringify(i.payload).toLowerCase().includes(q)
    );
  }, [items, query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind || !config || !title) return;

    fetchJson<ModuleItem>('/api/v1/personal-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        title,
        description: description || undefined,
        status,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        payload: buildPayload(config, fieldValues),
      }),
    })
      .then(() => {
        setTitle('');
        setDescription('');
        setDueAt('');
        setFieldValues({});
        loadItems();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function markDone(id: string) {
    fetchJson<ModuleItem>(`/api/v1/personal-modules/${id}/done`, { method: 'POST' })
      .then(() => loadItems())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function removeItem(id: string) {
    fetch(`/api/v1/personal-modules/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Delete failed');
        loadItems();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  if (!kind || !config) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">Unknown module.</p>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <PageHeader title={config.title} description={config.description}>
        <button
          type="button"
          onClick={() => document.getElementById('module-form')?.querySelector('input')?.focus()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New {config.label.toLowerCase()} item
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <section
        id="module-form"
        className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
      >
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Add {config.label.toLowerCase()} item
        </h3>
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="module-title"
          />
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="module-due-at"
          />
          <textarea
            placeholder="Description / notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-20 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
            data-testid="module-description"
          />
          {config.fields.map((field) => (
            <div key={field.key} className="sm:col-span-1">
              {field.type === 'select' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`module-field-${field.key}`}
                >
                  <option value="">{field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  placeholder={field.placeholder}
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="h-20 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`module-field-${field.key}`}
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.label}
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`module-field-${field.key}`}
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!title}
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
          {(['active', 'done', 'archived'] as const).map((s) => (
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

      <div className="space-y-3" data-testid="module-list">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

        <AnimatePresence mode="popLayout">
          {filtered.map((item, index) => (
            <motion.div
              key={item.id}
              data-testid={`module-card-${item.title}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h4>
                </div>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  {item.dueAt && <span>Due {formatDate(item.dueAt)}</span>}
                  {Object.entries(item.payload).map(([k, v]) => (
                    <span key={k} className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => markDone(item.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                      'bg-[var(--accent-success)]/10 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/20'
                    )}
                    data-testid={`module-done-${item.id}`}
                  >
                    <Check className="h-3.5 w-3.5" /> Done
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--text-danger)]/10 text-[var(--text-danger)] hover:bg-[var(--text-danger)]/20'
                  )}
                  data-testid={`module-delete-${item.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No {config.label.toLowerCase()} items found.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
