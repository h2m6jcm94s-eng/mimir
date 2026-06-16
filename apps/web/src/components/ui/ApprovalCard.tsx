'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Check, X } from 'lucide-react';
import { TierBadge } from './TierBadge';

interface ApprovalCardProps {
  title: string;
  blastRadius: string;
  tier: 0 | 1 | 2;
  onApprove?: () => void;
  onDeny?: () => void;
  className?: string;
}

export function ApprovalCard({
  title,
  blastRadius,
  tier,
  onApprove,
  onDeny,
  className,
}: ApprovalCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/5 p-4 shadow-card',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
            <TierBadge tier={tier} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{blastRadius}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-[var(--accent-success)]/10 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/20'
              )}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={onDeny}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20'
              )}
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
