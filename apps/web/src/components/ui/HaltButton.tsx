'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface HaltButtonProps {
  className?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// TODO: Replace with a real Clerk session token in production.
const AUTH_HEADER = 'Bearer test';

interface HaltState {
  halted: boolean;
  reason?: string;
  triggeredAt?: string;
  triggeredBy?: string;
}

export function HaltButton({ className }: HaltButtonProps) {
  const [halted, setHalted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchState() {
      try {
        const res = await fetch(`${API_URL}/v1/halt`, {
          headers: { Authorization: AUTH_HEADER },
        });
        if (!res.ok) throw new Error(`Failed to fetch halt state: ${res.status}`);
        const state = (await res.json()) as HaltState;
        if (!cancelled) setHalted(state.halted);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    fetchState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleHalt() {
    setLoading(true);
    setError(null);
    try {
      if (halted) {
        const res = await fetch(`${API_URL}/v1/halt`, {
          method: 'DELETE',
          headers: { Authorization: AUTH_HEADER },
        });
        if (!res.ok) throw new Error(`Failed to clear halt: ${res.status}`);
        setHalted(false);
      } else {
        const res = await fetch(`${API_URL}/v1/halt`, {
          method: 'POST',
          headers: {
            Authorization: AUTH_HEADER,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Emergency halt triggered from UI' }),
        });
        if (!res.ok) throw new Error(`Failed to set halt: ${res.status}`);
        const state = (await res.json()) as HaltState;
        setHalted(state.halted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleHalt}
      disabled={loading}
      title={error ?? undefined}
      className={cn(
        'relative rounded-md px-3 py-1.5 text-xs font-bold text-white transition-all duration-300',
        halted ? 'bg-gray-500' : 'bg-[var(--halt-red)] hover:bg-[var(--halt-red-hover)]',
        !halted && 'shadow-glow-amber animate-pulse',
        loading && 'opacity-70',
        error && 'ring-2 ring-amber-400',
        className
      )}
    >
      {halted ? 'HALTED' : 'HALT'}
    </button>
  );
}
