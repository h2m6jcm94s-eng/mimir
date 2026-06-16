'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Code,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  Palette,
  Plug,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type ConnectorStatus = 'connected' | 'disconnected' | 'error';
type Category = 'All' | 'Communication' | 'Dev' | 'Productivity' | 'Design';

interface Connector {
  id: string;
  name: string;
  description: string;
  category: Category;
  status: ConnectorStatus;
  lastSync?: string;
  icon: React.ElementType;
}

const initialConnectors: Connector[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, draft, and send email on your behalf.',
    category: 'Communication',
    status: 'connected',
    lastSync: '2 min ago',
    icon: Mail,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post updates and retrieve channel summaries.',
    category: 'Communication',
    status: 'connected',
    lastSync: '15 min ago',
    icon: MessageSquare,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Review PRs, issues, and repository activity.',
    category: 'Dev',
    status: 'connected',
    lastSync: '1 hr ago',
    icon: Code,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search pages and append notes to databases.',
    category: 'Productivity',
    status: 'disconnected',
    icon: FileText,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues, cycles, and project updates.',
    category: 'Productivity',
    status: 'error',
    lastSync: 'failed 3 hr ago',
    icon: GitBranch,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Pull comments and inspect design files.',
    category: 'Design',
    status: 'disconnected',
    icon: Palette,
  },
];

const categories: Category[] = ['All', 'Communication', 'Dev', 'Productivity', 'Design'];

const statusLabel: Record<ConnectorStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Sync error',
};

const statusDot: Record<ConnectorStatus, string> = {
  connected: 'bg-[var(--accent-success)]',
  disconnected: 'bg-[var(--text-muted)]',
  error: 'bg-[var(--accent-danger)]',
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors);
  const [active, setActive] = useState<Category>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return connectors.filter((c) => {
      const matchesCategory = active === 'All' || c.category === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [connectors, active, query]);

  function toggle(id: string) {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.status === 'connected') {
          return { ...c, status: 'disconnected', lastSync: undefined };
        }
        return { ...c, status: 'connected', lastSync: 'just now' };
      })
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Integrations that extend Mimir into your tools and data."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActive(cat)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                active === cat
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search connectors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:w-64"
          />
        </div>
      </div>

      <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((connector) => {
            const Icon = connector.icon;
            return (
              <motion.div
                key={connector.id}
                layout
                data-testid={`connector-${connector.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-shadow hover:shadow-hover"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    data-testid="connector-status"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-white',
                      statusDot[connector.status]
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    {statusLabel[connector.status]}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {connector.name}
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{connector.description}</p>

                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  {connector.status === 'connected' ? (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      <span>Synced {connector.lastSync}</span>
                    </>
                  ) : connector.status === 'error' ? (
                    <>
                      <X className="h-3 w-3 text-[var(--accent-danger)]" />
                      <span className="text-[var(--accent-danger)]">{connector.lastSync}</span>
                    </>
                  ) : (
                    <>
                      <Plug className="h-3 w-3" />
                      <span>Not configured</span>
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="connector-toggle"
                    onClick={() => toggle(connector.id)}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                      connector.status === 'connected'
                        ? 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                        : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                    )}
                  >
                    {connector.status === 'connected' ? (
                      <>
                        <X className="h-3.5 w-3.5" /> Disconnect
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Connect
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
          <p className="text-sm text-[var(--text-secondary)]">No connectors match your filters.</p>
        </div>
      )}
    </div>
  );
}
