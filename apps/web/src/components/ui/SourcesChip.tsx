'use client';

import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface SourcesChipProps {
  sources: string[];
  className?: string;
}

export function SourcesChip({ sources, className }: SourcesChipProps) {
  if (!sources.length) return null;

  return (
    <button
      type="button"
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle-solid)]',
        'bg-[var(--bg-primary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors',
        'hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]',
        className
      )}
    >
      <FileText className="h-3 w-3" />
      <span>Sources</span>
      <span className="rounded-full bg-[var(--bg-surface-raised)] px-1.5 py-0 text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">
        {sources.length}
      </span>
    </button>
  );
}
