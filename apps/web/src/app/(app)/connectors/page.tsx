'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  Check,
  Code,
  Contact,
  Database,
  FileText,
  GitBranch,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Palette,
  Pin,
  Plug,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ConnectorStatus = 'connected' | 'disconnected' | 'error';
type Category = 'All' | 'Communication' | 'Dev' | 'Productivity' | 'Design' | 'Social';

type ConnectorDef = {
  id: string;
  name: string;
  description: string;
  category: Category;
  status: ConnectorStatus;
  lastSync?: string;
  icon: React.ElementType;
  defaultScopes: string[];
  accountLabel?: string;
};

const connectorCatalog: ConnectorDef[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, draft, and send email on your behalf.',
    category: 'Communication',
    status: 'disconnected',
    icon: Mail,
    defaultScopes: [],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post updates and retrieve channel summaries.',
    category: 'Communication',
    status: 'disconnected',
    icon: MessageSquare,
    defaultScopes: [],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Send messages and read chat context via bot.',
    category: 'Communication',
    status: 'disconnected',
    icon: Send,
    defaultScopes: [],
    accountLabel: 'Default chat ID (optional)',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send messages through the WhatsApp Business API.',
    category: 'Communication',
    status: 'disconnected',
    icon: Smartphone,
    defaultScopes: [],
    accountLabel: 'Phone number ID (optional)',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Review PRs, issues, and repository activity.',
    category: 'Dev',
    status: 'disconnected',
    icon: Code,
    defaultScopes: ['repo'],
    accountLabel: 'Account / org (optional)',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'List media and publish posts on your behalf.',
    category: 'Social',
    status: 'disconnected',
    icon: Camera,
    defaultScopes: [],
    accountLabel: 'IG user ID (optional)',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'List pages and publish posts on your behalf.',
    category: 'Social',
    status: 'disconnected',
    icon: Globe,
    defaultScopes: [],
    accountLabel: 'Page ID (optional)',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'List boards and create pins on your behalf.',
    category: 'Social',
    status: 'disconnected',
    icon: Pin,
    defaultScopes: [],
    accountLabel: 'Username (optional)',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search pages and append notes to databases.',
    category: 'Productivity',
    status: 'disconnected',
    icon: FileText,
    defaultScopes: [],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues, cycles, and project updates.',
    category: 'Productivity',
    status: 'disconnected',
    icon: GitBranch,
    defaultScopes: [],
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Pull comments and inspect design files.',
    category: 'Design',
    status: 'disconnected',
    icon: Palette,
    defaultScopes: [],
  },
  {
    id: 'microsoftGraph',
    name: 'Microsoft Outlook',
    description: 'Read and send email through Microsoft Graph.',
    category: 'Communication',
    status: 'disconnected',
    icon: Mail,
    defaultScopes: [],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Post messages and read channel history.',
    category: 'Communication',
    status: 'disconnected',
    icon: MessageCircle,
    defaultScopes: [],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'List bases and read records from your workspaces.',
    category: 'Productivity',
    status: 'disconnected',
    icon: Database,
    defaultScopes: [],
  },
  {
    id: 'googleContacts',
    name: 'Google Contacts',
    description: 'List contacts and create new ones.',
    category: 'Productivity',
    status: 'disconnected',
    icon: Contact,
    defaultScopes: [],
  },
  {
    id: 'googleDocs',
    name: 'Google Docs',
    description: 'Read documents and create new drafts.',
    category: 'Productivity',
    status: 'disconnected',
    icon: FileText,
    defaultScopes: [],
  },
];

const categories: Category[] = ['All', 'Communication', 'Dev', 'Social', 'Productivity', 'Design'];

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
  const [connectors, setConnectors] = useState<ConnectorDef[]>(connectorCatalog);
  const [config, setConfig] = useState<Record<string, { account: string; secretRef: string }>>(() =>
    Object.fromEntries(connectorCatalog.map((c) => [c.id, { account: '', secretRef: c.id }]))
  );
  const [active, setActive] = useState<Category>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/connectors', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('fetch failed'))))
      .then(
        (data: { data: Array<{ kind: string; status: ConnectorStatus; lastSync?: string }> }) => {
          const byKind = new Map(data.data.map((c) => [c.kind, c]));
          setConnectors((prev) =>
            prev.map((c) => {
              const backend = byKind.get(c.id);
              if (!backend) return c;
              return { ...c, status: backend.status, lastSync: backend.lastSync ?? 'just now' };
            })
          );
        }
      )
      .catch(() => {
        // Leave mocked disconnected state if the API is unavailable.
      });
  }, []);

  async function toggle(id: string) {
    const def = connectors.find((c) => c.id === id);
    if (!def) return;

    if (def.status === 'connected') {
      setLoading(id);
      await fetch(`/api/v1/connectors/${id}`, { method: 'DELETE', credentials: 'include' });
      setLoading(null);
      setConnectors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'disconnected', lastSync: undefined } : c))
      );
      return;
    }

    const { account, secretRef } = config[id] ?? { account: '', secretRef: id };
    setLoading(id);
    const res = await fetch('/api/v1/connectors', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: id,
        account: account || undefined,
        secretRef,
        scopes: def.defaultScopes,
      }),
    });
    setLoading(null);

    if (res.ok) {
      setConnectors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'connected', lastSync: 'just now' } : c))
      );
    }
  }

  const filtered = useMemo(() => {
    return connectors.filter((c) => {
      const matchesCategory = active === 'All' || c.category === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [connectors, active, query]);

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
            const isConnected = connector.status === 'connected';
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

                {!isConnected && (
                  <div className="mt-3 space-y-2">
                    {connector.accountLabel && (
                      <input
                        type="text"
                        placeholder={connector.accountLabel}
                        value={config[connector.id]?.account ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            [connector.id]: { ...prev[connector.id], account: e.target.value },
                          }))
                        }
                        className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Secret alias (env var name)"
                      value={config[connector.id]?.secretRef ?? connector.id}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          [connector.id]: { ...prev[connector.id], secretRef: e.target.value },
                        }))
                      }
                      className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  {isConnected ? (
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
                    disabled={loading === connector.id}
                    onClick={() => toggle(connector.id)}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                      isConnected
                        ? 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                        : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                    )}
                  >
                    {isConnected ? (
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
