'use client';

import { cn } from '@/lib/utils';
import { Moon, Sparkles, Sun } from 'lucide-react';
import { type Theme, useTheme } from './ThemeProvider';

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'liquid-gold', label: 'Liquid Gold', icon: Sparkles },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn('inline-flex rounded-lg bg-[var(--bg-surface)] p-1 shadow-card', className)}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            theme === value
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]'
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
