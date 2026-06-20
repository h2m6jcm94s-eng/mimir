'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Node, Notification } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Copy,
  Cpu,
  Key,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Sun,
  Trash2,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type Tab =
  | 'general'
  | 'appearance'
  | 'api'
  | 'notifications'
  | 'members'
  | 'nodes'
  | 'security'
  | 'budget'
  | 'local-models'
  | 'email-digest';

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
  { id: 'nodes', label: 'Nodes', icon: Server },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'local-models', label: 'Local models', icon: Cpu },
  { id: 'email-digest', label: 'Email digest', icon: Mail },
];

const initialMembers: Member[] = [
  { id: 1, name: 'Alex Chen', email: 'alex@mimir.local', role: 'Owner' },
  { id: 2, name: 'Sam Doe', email: 'sam@mimir.local', role: 'Admin' },
  { id: 3, name: 'Jordan Lee', email: 'jordan@mimir.local', role: 'Member' },
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

function formatDate(date?: string): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

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

function StatusBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        className ?? 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]'
      )}
    >
      {label}
    </span>
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

function NodeStatusBadge({ status }: { status: Node['status'] }) {
  const meta: Record<Node['status'], { label: string; className: string }> = {
    up: { label: 'Online', className: 'bg-emerald-500/10 text-emerald-600' },
    degraded: { label: 'Degraded', className: 'bg-amber-500/10 text-amber-600' },
    down: { label: 'Offline', className: 'bg-red-500/10 text-red-600' },
    unknown: {
      label: 'Unknown',
      className: 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)]',
    },
  };
  const { label, className } = meta[status] ?? meta.unknown;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', className)}>
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [displayName, setDisplayName] = useState('Mimir User');
  const [email, setEmail] = useState('user@mimir.local');
  const [apiKey, setApiKey] = useState('mk_live_7f8a9b2c3d4e5f6a7b8c9d0e');
  const [preferences, setPreferences] = useState({
    approvals: true,
    weekly: true,
    marketing: false,
  });
  const [members, setMembers] = useState<Member[]>(initialMembers);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [pingingNodeId, setPingingNodeId] = useState<string | null>(null);
  const [rotatedKeys, setRotatedKeys] = useState<Record<string, string>>({});

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [budgetStatus, setBudgetStatus] = useState<{
    dailyBudgetUsd: number;
    monthlyBudgetUsd: number;
    throttleThreshold: number;
    enabled: boolean;
  } | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const MICROS_PER_DOLLAR = 1_000_000;
  const [budgetDraft, setBudgetDraft] = useState({
    dailyBudgetUsd: 0,
    monthlyBudgetUsd: 0,
    throttleThreshold: 0.7,
    enabled: true,
  });

  const [localModelConfig, setLocalModelConfig] = useState({
    baseUrl: 'http://localhost:11434',
    chatModel: 'llama3.1',
    embeddingModel: 'nomic-embed-text',
    embeddingDimension: 768,
    enabled: true,
  });
  const [localModelStatus, setLocalModelStatus] = useState<{
    reachable: boolean;
    models: Array<{ name: string }>;
    chatAvailable: boolean;
    embedAvailable: boolean;
    error?: string;
  } | null>(null);
  const [localModelsLoading, setLocalModelsLoading] = useState(false);
  const [localModelsError, setLocalModelsError] = useState<string | null>(null);
  const [localModelsSaving, setLocalModelsSaving] = useState(false);
  const [localModelsPulling, setLocalModelsPulling] = useState(false);
  const [pullModelName, setPullModelName] = useState('');

  const [digestPreference, setDigestPreference] = useState({
    frequency: 'daily' as 'daily' | 'weekly',
    enabled: true,
    includeNotifications: true,
    includeTasks: true,
    includeApprovals: true,
    includeReports: true,
    lastSentAt: null as string | null,
  });
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSending, setDigestSending] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestSuccess, setDigestSuccess] = useState<string | null>(null);

  function regenerateKey() {
    const suffix = Math.random().toString(36).slice(2, 14);
    setApiKey(`mk_live_${suffix}`);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function loadNodes() {
    try {
      setNodesLoading(true);
      setNodesError(null);
      const body = await fetchJson<{ data: Node[] }>('/api/v1/nodes');
      setNodes(body.data);
    } catch (err) {
      setNodesError(err instanceof Error ? err.message : 'Failed to load nodes');
    } finally {
      setNodesLoading(false);
    }
  }

  async function pingNode(id: string) {
    try {
      setPingingNodeId(id);
      await fetchJson(`/api/v1/nodes/${id}/ping`, { method: 'POST' });
      await loadNodes();
    } catch (err) {
      setNodesError(err instanceof Error ? err.message : 'Ping failed');
    } finally {
      setPingingNodeId(null);
    }
  }

  async function rotateNodeKey(id: string) {
    try {
      const body = await fetchJson<{ data: { apiKey: string } }>(`/api/v1/nodes/${id}/rotate-key`, {
        method: 'POST',
      });
      setRotatedKeys((prev) => ({ ...prev, [id]: body.data.apiKey }));
    } catch (err) {
      setNodesError(err instanceof Error ? err.message : 'Key rotation failed');
    }
  }

  async function loadNotifications() {
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const body = await fetchJson<{ data: Notification[] }>('/api/v1/notifications?limit=50');
      setNotifications(body.data);
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function loadProfile() {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const body = await fetchJson<{ data: { email: string; pinSet: boolean } }>(
        '/api/v1/users/me'
      );
      setEmail(body.data.email);
      setPinSet(body.data.pinSet);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function savePin() {
    setPinError(null);
    setPinSuccess(false);
    if (newPin.length < 4) {
      setPinError('PIN must be at least 4 characters.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and confirmation do not match.');
      return;
    }
    setPinLoading(true);
    try {
      const payload: { pin: string; currentPin?: string } = { pin: newPin };
      if (pinSet) payload.currentPin = currentPin;
      await fetchJson('/api/v1/users/me/pin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPinSuccess(true);
      setPinSet(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Failed to save PIN');
    } finally {
      setPinLoading(false);
    }
  }

  async function loadBudget() {
    try {
      setBudgetLoading(true);
      setBudgetError(null);
      const body = await fetchJson<{
        data: {
          dailyBudgetUsd: number;
          monthlyBudgetUsd: number;
          throttleThreshold: number;
          enabled: boolean;
        };
      }>('/api/v1/budget');
      setBudgetStatus(body.data);
      setBudgetDraft({
        dailyBudgetUsd: body.data.dailyBudgetUsd / MICROS_PER_DOLLAR,
        monthlyBudgetUsd: body.data.monthlyBudgetUsd / MICROS_PER_DOLLAR,
        throttleThreshold: body.data.throttleThreshold,
        enabled: body.data.enabled,
      });
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : 'Failed to load budget');
    } finally {
      setBudgetLoading(false);
    }
  }

  async function saveBudget() {
    setBudgetSaving(true);
    setBudgetError(null);
    try {
      await fetchJson('/api/v1/budget', {
        method: 'PUT',
        body: JSON.stringify({
          dailyBudgetUsd: budgetDraft.dailyBudgetUsd,
          monthlyBudgetUsd: budgetDraft.monthlyBudgetUsd,
          throttleThreshold: budgetDraft.throttleThreshold,
          enabled: budgetDraft.enabled,
        }),
      });
      await loadBudget();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setBudgetSaving(false);
    }
  }

  async function loadLocalModels() {
    try {
      setLocalModelsLoading(true);
      setLocalModelsError(null);
      const configBody = await fetchJson<{ data: typeof localModelConfig }>(
        '/api/v1/models/local/config'
      );
      setLocalModelConfig(configBody.data);
      const statusBody = await fetchJson<{ data: typeof localModelStatus }>(
        '/api/v1/models/local/status'
      );
      setLocalModelStatus(statusBody.data);
    } catch (err) {
      setLocalModelsError(err instanceof Error ? err.message : 'Failed to load local models');
    } finally {
      setLocalModelsLoading(false);
    }
  }

  async function saveLocalModels() {
    setLocalModelsSaving(true);
    setLocalModelsError(null);
    try {
      await fetchJson('/api/v1/models/local/config', {
        method: 'PUT',
        body: JSON.stringify(localModelConfig),
      });
      await loadLocalModels();
    } catch (err) {
      setLocalModelsError(err instanceof Error ? err.message : 'Failed to save local model config');
    } finally {
      setLocalModelsSaving(false);
    }
  }

  async function pullLocalModel() {
    if (!pullModelName.trim()) return;
    setLocalModelsPulling(true);
    setLocalModelsError(null);
    try {
      await fetchJson('/api/v1/models/local/pull', {
        method: 'POST',
        body: JSON.stringify({ model: pullModelName.trim() }),
      });
      setPullModelName('');
      await loadLocalModels();
    } catch (err) {
      setLocalModelsError(err instanceof Error ? err.message : 'Failed to pull model');
    } finally {
      setLocalModelsPulling(false);
    }
  }

  async function loadDigestPreference() {
    try {
      setDigestLoading(true);
      setDigestError(null);
      const body = await fetchJson<{ data: typeof digestPreference }>('/api/v1/email-digest/me');
      setDigestPreference(body.data);
    } catch (err) {
      setDigestError(
        err instanceof Error ? err.message : 'Failed to load email digest preferences'
      );
    } finally {
      setDigestLoading(false);
    }
  }

  async function saveDigestPreference() {
    setDigestSaving(true);
    setDigestError(null);
    setDigestSuccess(null);
    try {
      const body = await fetchJson<{ data: typeof digestPreference }>('/api/v1/email-digest/me', {
        method: 'PUT',
        body: JSON.stringify({
          frequency: digestPreference.frequency,
          enabled: digestPreference.enabled,
          includeNotifications: digestPreference.includeNotifications,
          includeTasks: digestPreference.includeTasks,
          includeApprovals: digestPreference.includeApprovals,
          includeReports: digestPreference.includeReports,
        }),
      });
      setDigestPreference(body.data);
      setDigestSuccess('Digest preferences saved.');
      setTimeout(() => setDigestSuccess(null), 3000);
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : 'Failed to save digest preferences');
    } finally {
      setDigestSaving(false);
    }
  }

  async function sendDigestNow() {
    setDigestSending(true);
    setDigestError(null);
    setDigestSuccess(null);
    try {
      const body = await fetchJson<{ data: { sent: boolean; recipient?: string; error?: string } }>(
        '/api/v1/email-digest/me/send-now',
        { method: 'POST' }
      );
      if (body.data.sent) {
        setDigestSuccess(`Digest sent to ${body.data.recipient ?? 'your email'}.`);
      } else {
        setDigestError(body.data.error ?? 'Digest could not be sent');
      }
      await loadDigestPreference();
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : 'Failed to send digest');
    } finally {
      setDigestSending(false);
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await fetchJson(`/api/v1/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Failed to mark read');
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'nodes') {
      void loadNodes();
    }
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'notifications') {
      void loadNotifications();
    }
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'security') {
      void loadProfile();
    }
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'budget') {
      void loadBudget();
    }
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'local-models') {
      void loadLocalModels();
    }
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only when tab becomes active to avoid re-fetch loops
  useEffect(() => {
    if (tab === 'email-digest') {
      void loadDigestPreference();
    }
  }, [tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage account, appearance, API keys, nodes, and workspace."
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
              <div className="space-y-6">
                <Section title="Email preferences">
                  <div className="space-y-3">
                    <ToggleRow
                      label="Approval requests"
                      description="Notify me when a human approval is required."
                      checked={preferences.approvals}
                      onChange={(v) => setPreferences((n) => ({ ...n, approvals: v }))}
                      data-testid="toggle-approvals"
                    />
                    <ToggleRow
                      label="Weekly digest"
                      description="Send a summary of cost, tasks, and security every Monday."
                      checked={preferences.weekly}
                      onChange={(v) => setPreferences((n) => ({ ...n, weekly: v }))}
                      data-testid="toggle-weekly"
                    />
                    <ToggleRow
                      label="Product updates"
                      description="Announcements about new features and connectors."
                      checked={preferences.marketing}
                      onChange={(v) => setPreferences((n) => ({ ...n, marketing: v }))}
                      data-testid="toggle-marketing"
                    />
                  </div>
                </Section>

                <Section title="Recent notifications">
                  {notificationsError && (
                    <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                      {notificationsError}
                    </div>
                  )}

                  {notificationsLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">Loading notifications…</div>
                  ) : notifications.length === 0 ? (
                    <div
                      data-testid="notifications-empty"
                      className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-8 text-center shadow-card"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        No notifications yet
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        New approvals, task completions, and system events will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n) => {
                        const unread = n.readAt === null;
                        return (
                          <div
                            key={n.id}
                            data-testid={`notification-card-${n.id}`}
                            className={cn(
                              'rounded-xl bg-[var(--bg-surface)] p-4 shadow-card',
                              unread && 'ring-1 ring-[var(--accent-primary)]/10'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-[var(--text-primary)]">
                                    {n.title}
                                  </p>
                                  {unread && (
                                    <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                  {n.body}
                                </p>
                                <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                                  {formatDate(n.createdAt)}
                                </p>
                              </div>
                              <button
                                type="button"
                                data-testid={`mark-read-${n.id}`}
                                disabled={!unread}
                                onClick={() => markNotificationRead(n.id)}
                                className={cn(
                                  'shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
                                  unread
                                    ? 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white'
                                    : 'cursor-default text-[var(--text-muted)]'
                                )}
                              >
                                {unread ? 'Mark read' : 'Read'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </div>
            )}

            {tab === 'nodes' && (
              <Section title="Mesh nodes">
                {nodesError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {nodesError}
                  </div>
                )}

                {nodesLoading ? (
                  <div className="text-sm text-[var(--text-muted)]">Loading nodes…</div>
                ) : nodes.length === 0 ? (
                  <div
                    data-testid="nodes-empty"
                    className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-8 text-center shadow-card"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      No nodes enrolled
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Enroll a node from the CLI or status page to manage it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nodes.map((node) => {
                      const rotatedKey = rotatedKeys[node.id];
                      return (
                        <div
                          key={node.id}
                          data-testid={`node-card-${node.id}`}
                          className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <p
                                  data-testid={`node-name-${node.id}`}
                                  className="text-sm font-medium text-[var(--text-primary)]"
                                >
                                  {node.name}
                                </p>
                                <NodeStatusBadge status={node.status} />
                              </div>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {node.kind} · tier {node.tier}
                                {node.tailnetAddr ? ` · ${node.tailnetAddr}` : ''}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                Last seen: {formatDate(node.lastSeen)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                data-testid={`node-ping-${node.id}`}
                                disabled={pingingNodeId === node.id}
                                onClick={() => pingNode(node.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)] disabled:opacity-50"
                              >
                                <Activity className="h-3.5 w-3.5" />
                                {pingingNodeId === node.id ? 'Pinging…' : 'Ping'}
                              </button>
                              <button
                                type="button"
                                data-testid={`node-rotate-${node.id}`}
                                onClick={() => rotateNodeKey(node.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Rotate key
                              </button>
                            </div>
                          </div>

                          {rotatedKey && (
                            <div className="mt-3 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-3">
                              <p className="text-xs font-medium text-[var(--text-primary)]">
                                New API key
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={rotatedKey}
                                  data-testid={`node-key-${node.id}`}
                                  className="h-8 flex-1 rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(rotatedKey)}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-raised)] px-2 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-white"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                              </div>
                              <p className="mt-1 text-[10px] text-[var(--accent-danger)]">
                                Copy this now — it will not be shown again.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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

            {tab === 'security' && (
              <Section title="Approval PIN">
                {profileError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {profileError}
                  </div>
                )}
                {pinError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {pinError}
                  </div>
                )}
                {pinSuccess && (
                  <div className="rounded-lg border border-[var(--accent-success)]/20 bg-[var(--accent-success)]/10 px-4 py-3 text-sm text-[var(--accent-success)]">
                    PIN updated successfully.
                  </div>
                )}
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">PIN status</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        A PIN is required to approve or deny sensitive actions.
                      </p>
                    </div>
                    <span
                      data-testid="pin-status"
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        pinSet
                          ? 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                          : 'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]'
                      )}
                    >
                      {pinSet ? 'Set' : 'Not set'}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {pinSet && (
                      <div>
                        <label
                          htmlFor="current-pin"
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Current PIN
                        </label>
                        <input
                          id="current-pin"
                          data-testid="current-pin-input"
                          type="password"
                          inputMode="numeric"
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        />
                      </div>
                    )}
                    <div>
                      <label
                        htmlFor="new-pin"
                        className="block text-xs font-medium text-[var(--text-secondary)]"
                      >
                        New PIN
                      </label>
                      <input
                        id="new-pin"
                        data-testid="new-pin-input"
                        type="password"
                        inputMode="numeric"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="confirm-pin"
                        className="block text-xs font-medium text-[var(--text-secondary)]"
                      >
                        Confirm new PIN
                      </label>
                      <input
                        id="confirm-pin"
                        data-testid="confirm-pin-input"
                        type="password"
                        inputMode="numeric"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      data-testid="save-pin"
                      disabled={pinLoading || profileLoading}
                      onClick={savePin}
                      className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                    >
                      {pinLoading ? 'Saving…' : pinSet ? 'Change PIN' : 'Set PIN'}
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {tab === 'local-models' && (
              <Section title="Local model runtime">
                {localModelsError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {localModelsError}
                  </div>
                )}
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  {localModelsLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">Loading local models…</div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            Local model runtime
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Run chat and embeddings on your own hardware (Tier 0).
                          </p>
                        </div>
                        <StatusBadge
                          label={
                            localModelStatus?.reachable
                              ? localModelStatus?.chatAvailable && localModelStatus?.embedAvailable
                                ? 'Online'
                                : 'Partial'
                              : 'Offline'
                          }
                          className={
                            localModelStatus?.reachable
                              ? localModelStatus?.chatAvailable && localModelStatus?.embedAvailable
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-amber-500/10 text-amber-600'
                              : 'bg-red-500/10 text-red-600'
                          }
                        />
                      </div>

                      <div className="mb-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="local-model-url"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Ollama base URL
                          </label>
                          <input
                            id="local-model-url"
                            type="text"
                            value={localModelConfig.baseUrl}
                            onChange={(e) =>
                              setLocalModelConfig((c) => ({ ...c, baseUrl: e.target.value }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="local-chat-model"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Chat model
                          </label>
                          <input
                            id="local-chat-model"
                            type="text"
                            value={localModelConfig.chatModel}
                            onChange={(e) =>
                              setLocalModelConfig((c) => ({ ...c, chatModel: e.target.value }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="local-embed-model"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Embedding model
                          </label>
                          <input
                            id="local-embed-model"
                            type="text"
                            value={localModelConfig.embeddingModel}
                            onChange={(e) =>
                              setLocalModelConfig((c) => ({ ...c, embeddingModel: e.target.value }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="local-embed-dim"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Embedding dimension
                          </label>
                          <input
                            id="local-embed-dim"
                            type="number"
                            min={1}
                            value={localModelConfig.embeddingDimension}
                            onChange={(e) =>
                              setLocalModelConfig((c) => ({
                                ...c,
                                embeddingDimension: Number(e.target.value),
                              }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div className="flex items-center gap-3 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() =>
                              setLocalModelConfig((c) => ({ ...c, enabled: !c.enabled }))
                            }
                            className={cn(
                              'relative h-6 w-11 rounded-full transition-colors',
                              localModelConfig.enabled
                                ? 'bg-[var(--accent-primary)]'
                                : 'bg-[var(--bg-surface-raised)]'
                            )}
                            aria-pressed={localModelConfig.enabled}
                          >
                            <span
                              className={cn(
                                'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                                localModelConfig.enabled ? 'left-6' : 'left-1'
                              )}
                            />
                          </button>
                          <span className="text-sm text-[var(--text-secondary)]">
                            Enable local models
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label
                          htmlFor="pull-model-name"
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Pull model
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            id="pull-model-name"
                            type="text"
                            placeholder="e.g. llama3.1"
                            value={pullModelName}
                            onChange={(e) => setPullModelName(e.target.value)}
                            className="h-9 flex-1 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                          <button
                            type="button"
                            disabled={localModelsPulling || !pullModelName.trim()}
                            onClick={pullLocalModel}
                            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                          >
                            {localModelsPulling ? 'Pulling…' : 'Pull'}
                          </button>
                        </div>
                      </div>

                      {localModelStatus && localModelStatus.models.length > 0 && (
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                            Pulled models
                          </p>
                          <ul className="max-h-40 overflow-auto rounded-lg border border-[var(--border-subtle-solid)]">
                            {localModelStatus.models.map((m) => (
                              <li
                                key={m.name}
                                className="flex items-center justify-between border-b border-[var(--border-subtle-solid)] px-3 py-2 text-sm text-[var(--text-primary)] last:border-0"
                              >
                                <span>{m.name}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {m.name === localModelConfig.chatModel && 'chat'}{' '}
                                  {m.name === localModelConfig.embeddingModel && 'embed'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {localModelStatus?.error && (
                        <div className="mb-4 rounded-lg border border-[var(--border-warning)] bg-[var(--bg-warning)] px-3 py-2 text-xs text-[var(--text-warning)]">
                          {localModelStatus.error}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={localModelsSaving}
                          onClick={saveLocalModels}
                          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                        >
                          {localModelsSaving ? 'Saving…' : 'Save local model config'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Section>
            )}

            {tab === 'email-digest' && (
              <Section title="Email digest">
                {digestError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {digestError}
                  </div>
                )}
                {digestSuccess && (
                  <div className="rounded-lg border border-[var(--border-success)] bg-[var(--bg-success)] px-4 py-3 text-sm text-[var(--text-success)]">
                    {digestSuccess}
                  </div>
                )}
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  {digestLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">
                      Loading digest preferences…
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            Email digest
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Receive a rollup of notifications, tasks, approvals, and reports.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDigestPreference((p) => ({ ...p, enabled: !p.enabled }))
                          }
                          className={cn(
                            'relative h-6 w-11 rounded-full transition-colors',
                            digestPreference.enabled
                              ? 'bg-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface-raised)]'
                          )}
                          aria-pressed={digestPreference.enabled}
                        >
                          <span
                            className={cn(
                              'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                              digestPreference.enabled ? 'left-6' : 'left-1'
                            )}
                          />
                        </button>
                      </div>

                      <div className="mb-4">
                        <label
                          htmlFor="digest-frequency"
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          Frequency
                        </label>
                        <select
                          id="digest-frequency"
                          value={digestPreference.frequency}
                          onChange={(e) =>
                            setDigestPreference((p) => ({
                              ...p,
                              frequency: e.target.value as 'daily' | 'weekly',
                            }))
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>

                      <div className="mb-4 grid gap-2 sm:grid-cols-2">
                        {[
                          { key: 'includeNotifications', label: 'Notifications' },
                          { key: 'includeTasks', label: 'Tasks' },
                          { key: 'includeApprovals', label: 'Approvals' },
                          { key: 'includeReports', label: 'Reports' },
                        ].map((item) => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
                          >
                            <input
                              type="checkbox"
                              checked={
                                digestPreference[
                                  item.key as keyof typeof digestPreference
                                ] as boolean
                              }
                              onChange={(e) =>
                                setDigestPreference((p) => ({ ...p, [item.key]: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-[var(--border-subtle-solid)]"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>

                      <p className="mb-4 text-xs text-[var(--text-muted)]">
                        Last sent: {formatDate(digestPreference.lastSentAt ?? undefined)}
                      </p>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={digestSending}
                          onClick={sendDigestNow}
                          className="rounded-lg bg-[var(--bg-surface-raised)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-50"
                        >
                          {digestSending ? 'Sending…' : 'Send now'}
                        </button>
                        <button
                          type="button"
                          disabled={digestSaving}
                          onClick={saveDigestPreference}
                          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                        >
                          {digestSaving ? 'Saving…' : 'Save preferences'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Section>
            )}

            {tab === 'budget' && (
              <Section title="Budget limits">
                {budgetError && (
                  <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
                    {budgetError}
                  </div>
                )}
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  {budgetLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">Loading budget…</div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            Budget enforcement
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Pause cloud-tier actions when limits are reached.
                          </p>
                        </div>
                        <button
                          type="button"
                          data-testid="toggle-budget-enabled"
                          onClick={() => setBudgetDraft((d) => ({ ...d, enabled: !d.enabled }))}
                          className={cn(
                            'relative h-6 w-11 rounded-full transition-colors',
                            budgetDraft.enabled
                              ? 'bg-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface-raised)]'
                          )}
                          aria-pressed={budgetDraft.enabled}
                        >
                          <span
                            className={cn(
                              'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                              budgetDraft.enabled ? 'left-6' : 'left-1'
                            )}
                          />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="daily-budget"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Daily budget (USD)
                          </label>
                          <input
                            id="daily-budget"
                            data-testid="daily-budget-input"
                            type="number"
                            min={0}
                            value={budgetDraft.dailyBudgetUsd}
                            onChange={(e) =>
                              setBudgetDraft((d) => ({
                                ...d,
                                dailyBudgetUsd: Number(e.target.value),
                              }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="monthly-budget"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Monthly budget (USD)
                          </label>
                          <input
                            id="monthly-budget"
                            data-testid="monthly-budget-input"
                            type="number"
                            min={0}
                            value={budgetDraft.monthlyBudgetUsd}
                            onChange={(e) =>
                              setBudgetDraft((d) => ({
                                ...d,
                                monthlyBudgetUsd: Number(e.target.value),
                              }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="throttle-threshold"
                            className="block text-xs font-medium text-[var(--text-secondary)]"
                          >
                            Throttle threshold ({(budgetDraft.throttleThreshold * 100).toFixed(0)}
                            %)
                          </label>
                          <input
                            id="throttle-threshold"
                            data-testid="throttle-threshold-input"
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={budgetDraft.throttleThreshold}
                            onChange={(e) =>
                              setBudgetDraft((d) => ({
                                ...d,
                                throttleThreshold: Number(e.target.value),
                              }))
                            }
                            className="mt-2 w-full"
                          />
                          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                            Pause T2 actions when daily spend reaches this percentage of the budget.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          data-testid="save-budget"
                          disabled={budgetSaving}
                          onClick={saveBudget}
                          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
                        >
                          {budgetSaving ? 'Saving…' : 'Save budget'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
