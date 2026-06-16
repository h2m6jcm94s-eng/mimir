'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface HaltButtonProps {
  className?: string;
}

export function HaltButton({ className }: HaltButtonProps) {
  const [halted, setHalted] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setHalted((prev) => !prev)}
      className={cn(
        'relative rounded-md px-3 py-1.5 text-xs font-bold text-white transition-all duration-300',
        halted ? 'bg-gray-500' : 'bg-[var(--halt-red)] hover:bg-[var(--halt-red-hover)]',
        !halted && 'shadow-glow-amber animate-pulse',
        className
      )}
    >
      {halted ? 'HALTED' : 'HALT'}
    </button>
  );
}
