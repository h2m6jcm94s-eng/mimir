'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Notification, NotificationPriority } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, Check, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const priorityMeta: Record<
  NotificationPriority,
  { color: string; border: string; icon: typeof Info }
> = {
  low: {
    color: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
    border: 'border-[var(--text-muted)]/20',
    icon: Info,
  },
  normal: {
    color: 'bg-blue-500/10 text-blue-600',
    border: 'border-blue-500/20',
    icon: Bell,
  },
  high: {
    color: 'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]',
    border: 'border-[var(--accent-danger)]/20',
    icon: AlertTriangle,
  },
};

const kindMeta: Record<string, { icon: typeof Info; color: string }> = {
  'approval.requested': { icon: Bell, color: 'text-[var(--accent-warning)]' },
  'job.failed': { icon: XCircle, color: 'text-[var(--accent-danger)]' },
  'job.done': { icon: CheckCircle2, color: 'text-green-600' },
  'cloud_worker.returned': { icon: Info, color: 'text-blue-600' },
};

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

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const priority = priorityMeta[notification.priority];
  const Icon = priority.icon;
  const kind = kindMeta[notification.kind] ?? { icon: Info, color: 'text-[var(--text-muted)]' };
  const KindIcon = kind.icon;
  const unread = notification.readAt === null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      data-testid={`notification-card-${notification.id}`}
      className={cn(
        'rounded-xl border bg-[var(--bg-primary)] p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        priority.border,
        unread && 'ring-1 ring-[var(--accent-primary)]/10'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            priority.color
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)]">
                <KindIcon className={cn('mr-1.5 inline h-3.5 w-3.5', kind.color)} />
                {notification.title}
              </h4>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                {notification.body}
              </p>
            </div>
            {unread && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatWhen(notification.createdAt)}
            </span>

            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              disabled={!unread}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors',
                unread
                  ? 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white'
                  : 'cursor-default text-[var(--text-muted)]'
              )}
            >
              <Check className="h-3 w-3" />
              {unread ? 'Mark read' : 'Read'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  async function load() {
    try {
      setLoading(true);
      const response = await fetchJson<{ data: Notification[] }>('/api/v1/notifications?limit=100');
      setNotifications(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetchJson(`/api/v1/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function markAllRead() {
    try {
      const unread = notifications.filter((n) => n.readAt === null);
      await Promise.all(
        unread.map((n) => fetchJson(`/api/v1/notifications/${n.id}/read`, { method: 'POST' }))
      );
      setNotifications((prev) =>
        prev.map((n) => (n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load only on mount to avoid re-fetch loops
  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const visible = notifications.filter((n) => (filter === 'unread' ? n.readAt === null : true));
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay on top of approvals, task completions, and system events."
      >
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0 || loading}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] disabled:opacity-50'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--border-danger)] bg-[var(--bg-danger)] px-4 py-3 text-sm text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'unread'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filter === key
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
              )}
            >
              {key === 'all' ? 'All' : 'Unread'}
              {key === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <span className="text-xs text-[var(--text-muted)]">Loading...</span>}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visible.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </AnimatePresence>

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] py-16 text-center">
            <Bell className="h-10 w-10 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              No notifications
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {filter === 'unread'
                ? 'You have read all your notifications.'
                : 'New approvals, task updates, and events will appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
