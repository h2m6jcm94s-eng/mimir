'use client';

import { cn } from '@/lib/utils';

interface CostChipProps {
  amount: number;
  className?: string;
}

export function CostChip({ amount, className }: CostChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        'bg-[var(--cost-chip-bg)] text-[var(--cost-chip-text)]',
        className
      )}
    >
      ${amount.toFixed(2)} today
    </span>
  );
}
