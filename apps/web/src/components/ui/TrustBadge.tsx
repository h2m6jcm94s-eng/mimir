'use client';

import { cn } from '@/lib/utils';

interface TrustBadgeProps {
  model: 'kimi' | 'claude' | 'ollama' | string;
  confidence: number;
  className?: string;
}

export function TrustBadge({ model, confidence, className }: TrustBadgeProps) {
  const color =
    model === 'kimi'
      ? 'bg-blue-500/10 text-blue-600'
      : model === 'claude'
        ? 'bg-amber-500/10 text-amber-600'
        : 'bg-slate-500/10 text-slate-600';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        color,
        className
      )}
    >
      <span className="capitalize">{model}</span>
      <span className="opacity-60">·</span>
      <span>{Math.round(confidence * 100)}%</span>
    </span>
  );
}
