'use client';

import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';

interface FooterProps {
  offline?: boolean;
  className?: string;
}

export function Footer({ offline, className }: FooterProps) {
  return (
    <footer
      className={cn(
        'flex h-10 items-center justify-between border-t border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-4 text-xs',
        className
      )}
    >
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <span>Mimir v0.0.1</span>
        <span>·</span>
        <span
          className={cn(
            'flex items-center gap-1.5',
            offline ? 'text-amber-600' : 'text-emerald-600'
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', offline ? 'bg-amber-500' : 'bg-emerald-500')}
          />
          {offline ? 'Local model active' : 'Connected'}
        </span>
      </div>
      <TierBadge tier={0} />
    </footer>
  );
}
