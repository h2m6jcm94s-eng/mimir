'use client';

import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const commands = [
  { name: 'Console', href: '/console', shortcut: 'G C' },
  { name: 'Status', href: '/status', shortcut: 'G S' },
  { name: 'Tasks', href: '/tasks', shortcut: 'G T' },
  { name: 'Approvals', href: '/approvals', shortcut: 'G A' },
  { name: 'Briefings', href: '/briefings', shortcut: 'G B' },
  { name: 'Meetings', href: '/meetings', shortcut: 'G M' },
  { name: 'Emails', href: '/emails', shortcut: 'G E' },
  { name: 'Skills', href: '/skills', shortcut: 'G K' },
  { name: 'Settings', href: '/settings', shortcut: 'G ,' },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? onClose() : undefined;
      }
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = commands.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 p-4 pt-[15vh] backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle-solid)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, skills, actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.map((cmd) => (
            <Link
              key={cmd.name}
              href={cmd.href}
              onClick={onClose}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
            >
              <span>{cmd.name}</span>
              <kbd className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px]">
                {cmd.shortcut}
              </kbd>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              No results found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
