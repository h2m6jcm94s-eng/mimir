'use client';

import { cn } from '@/lib/utils';

interface ModelBadgeProps {
  model: 'kimi' | 'claude' | 'ollama' | string;
  className?: string;
}

export function ModelBadge({ model, className }: ModelBadgeProps) {
  const color =
    model === 'kimi'
      ? 'bg-[var(--kimi-badge)]/10 text-[var(--kimi-badge)]'
      : model === 'claude'
        ? 'bg-[var(--claude-badge)]/10 text-[var(--claude-badge)]'
        : 'bg-[var(--ollama-badge)]/10 text-[var(--ollama-badge)]';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        color,
        className
      )}
    >
      {model}
    </span>
  );
}
