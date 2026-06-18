'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CostChip } from '@/components/ui/CostChip';
import { HaltButton } from '@/components/ui/HaltButton';
import { cn } from '@/lib/utils';
import { Bell, Search, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TopBarProps {
  pageTitle: string;
  offline?: boolean;
  onSearchClick?: () => void;
  className?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function TopBar({ pageTitle, offline, onSearchClick, className }: TopBarProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { count } = await fetchJson<{ count: number }>('/api/v1/notifications/unread-count');
        if (mounted) setUnreadCount(count);
      } catch {
        // Best-effort; don't break the UI if notifications are unavailable.
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border-subtle-solid)] bg-[var(--bg-glass)] px-4 backdrop-blur-xl',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        {offline && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <WifiOff className="h-3 w-3" />
            Offline
          </span>
        )}

        <button
          type="button"
          onClick={onSearchClick}
          className="hidden items-center gap-2 rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-muted)] shadow-sm transition-all hover:border-[var(--border-focus)] hover:text-[var(--text-secondary)] sm:inline-flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-2 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <CostChip amount={0.0} />
        <HaltButton />

        <Link
          href="/notifications"
          data-testid="notifications-bell"
          className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              data-testid="notifications-badge"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-danger)] px-1 text-[10px] font-medium text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="h-8 w-8 rounded-full bg-[var(--bg-surface-raised)]" />
      </div>
    </header>
  );
}
