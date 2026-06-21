'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { Download, Search, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface MarketplaceItem {
  id: string;
  kind: 'skill' | 'connector' | 'workflow';
  status: 'draft' | 'published' | 'archived';
  name: string;
  description: string;
  payload: Record<string, unknown>;
  installs: number;
  priceUsd: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  installed: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

const kindLabel: Record<string, string> = {
  skill: 'Skill',
  connector: 'Connector',
  workflow: 'Workflow',
};

const kindClass: Record<string, string> = {
  skill: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]',
  connector: 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]',
  workflow: 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]',
};

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState<'all' | 'skill' | 'connector' | 'workflow'>('all');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ data: MarketplaceItem[] }>('/api/v1/marketplace/items')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function install(itemId: string) {
    setActionId(itemId);
    try {
      await fetchJson<{ data: { installed: boolean; installId: string } }>(
        `/api/v1/marketplace/items/${encodeURIComponent(itemId)}/install`,
        { method: 'POST' }
      );
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, installed: true } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const query = filter.toLowerCase();
    return items.filter((item) => {
      const matchesKind = kind === 'all' || item.kind === kind;
      const matchesQuery =
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.kind.toLowerCase().includes(query);
      return matchesKind && matchesQuery;
    });
  }, [items, filter, kind]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Discover and install skills, connectors, and workflows."
      />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search marketplace"
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'skill', 'connector', 'workflow'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                kind === k
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              {k === 'all' ? 'All' : kindLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">Loading marketplace...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              data-testid={`listing-${item.id}`}
              className={cn(
                'flex flex-col rounded-xl border bg-[var(--bg-surface)] p-4 shadow-card',
                item.installed
                  ? 'border-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle-solid)]'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.id}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    kindClass[item.kind]
                  )}
                >
                  {kindLabel[item.kind]}
                </span>
              </div>

              <p className="mt-3 flex-1 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-3">
                {item.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {Array.isArray(item.payload.tags) &&
                  item.payload.tags.map((tag, idx) => (
                    <span
                      key={`${item.id}-tag-${idx}`}
                      className="rounded-full border border-[var(--border-subtle-solid)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                    >
                      {String(tag)}
                    </span>
                  ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle-solid)] pt-3">
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Download className="h-3.5 w-3.5" />
                    {item.installs}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {item.priceUsd === 0 ? 'Free' : `$${item.priceUsd.toFixed(2)}`}
                  </span>
                </div>
                {item.installed ? (
                  <button
                    type="button"
                    data-testid="listing-install"
                    disabled
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent-primary)] disabled:opacity-70"
                  >
                    Installed
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="listing-install"
                    disabled={actionId === item.id}
                    onClick={() => install(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
