'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CostChip } from '@/components/ui/CostChip';
import { HaltButton } from '@/components/ui/HaltButton';
import { cn } from '@/lib/utils';
import { Search, WifiOff } from 'lucide-react';

interface TopBarProps {
  pageTitle: string;
  offline?: boolean;
  onSearchClick?: () => void;
  className?: string;
}

export function TopBar({ pageTitle, offline, onSearchClick, className }: TopBarProps) {
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

        <div className="h-8 w-8 rounded-full bg-[var(--bg-surface-raised)]" />
      </div>
    </header>
  );
}
