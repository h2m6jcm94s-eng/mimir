'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Copy,
  Key,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';

type Tab = 'general' | 'appearance' | 'api' | 'notifications' | 'members';

interface Member {
  id: number;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'members', label: 'Members', icon: Users },
];

const initialMembers: Member[] = [
  { id: 1, name: 'Alex Chen', email: 'alex@mimir.local', role: 'Owner' },
  { id: 2, name: 'Sam Doe', email: 'sam@mimir.local', role: 'Admin' },
  { id: 3, name: 'Jordan Lee', email: 'jordan@mimir.local', role: 'Member' },
];

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof tabs)[0];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
      )}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  'data-testid': testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  'data-testid'?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      <button
        type="button"
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-surface-raised)]'
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [displayName, setDisplayName] = useState('Mimir User');
  const [email, setEmail] = useState('user@mimir.local');
  const [apiKey, setApiKey] = useState('mk_live_7f8a9b2c3d4e5f6a7b8c9d0e');
  const [notifications, setNotifications] = useState({
    approvals: true,
    weekly: true,
    marketing: false,
  });
  const [members, setMembers] = useState<Member[]>(initialMembers);

  function regenerateKey() {
    const suffix = Math.random().toString(36).slice(2, 14);
    setApiKey(`mk_live_${suffix}`);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage account, appearance, API keys, and workspace."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1 rounded-xl bg-[var(--bg-surface)] p-2 shadow-card">
          {tabs.map((t) => (
            <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {tab === 'general' && (
              <>
                <Section title="Profile">
                  <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="display-name"
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Display name
                        </label>
                        <input
                          id="display-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
                      >
                        Save profile
                      </button>
                    </div>
                  </div>
                </Section>

                <Section title="Danger zone">
                  <div className="rounded-xl border border-[var(--accent-danger)]/20 bg-[var(--accent-danger)]/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Delete account data
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          This action cannot be undone.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--accent-danger)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-danger)]/90"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Section>
              </>
            )}

            {tab === 'appearance' && (
              <Section title="Theme">
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Color theme</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Choose your preferred lighting.
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>
              </Section>
            )}

            {tab === 'api' && (
              <Section title="API keys">
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Use this key to authenticate API requests from your mesh nodes.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Key className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        readOnly
                        value={apiKey}
                        data-testid="api-key"
                        className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] pl-8 pr-3 font-mono text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(apiKey)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button
                      type="button"
                      data-testid="regenerate-key"
                      onClick={regenerateKey}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {tab === 'notifications' && (
              <Section title="Email notifications">
                <div className="space-y-3">
                  <ToggleRow
                    label="Approval requests"
                    description="Notify me when a human approval is required."
                    checked={notifications.approvals}
                    onChange={(v) => setNotifications((n) => ({ ...n, approvals: v }))}
                    data-testid="toggle-approvals"
                  />
                  <ToggleRow
                    label="Weekly digest"
                    description="Send a summary of cost, tasks, and security every Monday."
                    checked={notifications.weekly}
                    onChange={(v) => setNotifications((n) => ({ ...n, weekly: v }))}
                    data-testid="toggle-weekly"
                  />
                  <ToggleRow
                    label="Product updates"
                    description="Announcements about new features and connectors."
                    checked={notifications.marketing}
                    onChange={(v) => setNotifications((n) => ({ ...n, marketing: v }))}
                    data-testid="toggle-marketing"
                  />
                </div>
              </Section>
            )}

            {tab === 'members' && (
              <Section title="Workspace members">
                <div className="overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-card">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle-solid)] p-4">
                    <span className="text-xs text-[var(--text-muted)]">
                      {members.length} members
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Invite
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                      <tr>
                        <th className="px-4 py-2 font-medium">Member</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle-solid)]">
                      {members.map((m) => (
                        <tr key={m.id} data-testid={`member-${m.id}`}>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {m.name}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{m.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-[var(--text-secondary)]">
                              {m.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              data-testid="remove-member"
                              onClick={() => removeMember(m.id)}
                              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-danger)]"
                              aria-label={`Remove ${m.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
