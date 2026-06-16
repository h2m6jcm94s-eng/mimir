'use client';

import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: 0 | 1 | 2;
  className?: string;
}

const labels: Record<number, string> = {
  0: 'Private',
  1: 'Local',
  2: 'Cloud',
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tier === 0 && 'bg-[var(--tier0-color)]/10 text-[var(--tier0-color)]',
        tier === 1 && 'bg-[var(--tier1-color)]/10 text-[var(--tier1-color)]',
        tier === 2 && 'bg-[var(--tier2-color)]/10 text-[var(--tier2-color)]',
        className
      )}
    >
      <span
        className={cn(
          'mr-1.5 h-1.5 w-1.5 rounded-full',
          tier === 0 && 'bg-[var(--tier0-color)]',
          tier === 1 && 'bg-[var(--tier1-color)]',
          tier === 2 && 'bg-[var(--tier2-color)]'
        )}
      />
      T{tier} · {labels[tier]}
    </span>
  );
}
