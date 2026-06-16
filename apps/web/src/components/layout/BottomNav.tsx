'use client';

import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Briefcase,
  CheckSquare,
  Command,
  KanbanSquare,
  LayoutDashboard,
  Library,
  MessageSquare,
  MoreHorizontal,
  Newspaper,
  Package,
  Puzzle,
  Scale,
  Settings,
  ShieldCheck,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const primary = [
  { href: '/console', label: 'Console', icon: LayoutDashboard },
  { href: '/status', label: 'Status', icon: Activity },
  { href: '/tasks', label: 'Tasks', icon: KanbanSquare },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
];

const more = [
  { href: '/briefings', label: 'Briefings', icon: Newspaper },
  { href: '/knowledge', label: 'Knowledge', icon: Library },
  { href: '/memory', label: 'Memory', icon: MessageSquare },
  { href: '/governance', label: 'Governance', icon: Scale },
  { href: '/cost', label: 'Cost', icon: Briefcase },
  { href: '/skills', label: 'Skills', icon: Wand2 },
  { href: '/connectors', label: 'Connectors', icon: Puzzle },
  { href: '/routines', label: 'Routines', icon: Command },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/marketplace', label: 'Marketplace', icon: Package },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[var(--border-subtle-solid)] bg-[var(--bg-glass)] px-2 backdrop-blur-xl sm:hidden">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors',
                active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors',
            open ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            role="button"
            tabIndex={0}
            aria-label="Close menu"
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
          />
          <div className="absolute bottom-20 left-4 right-4 rounded-2xl bg-[var(--bg-surface)] p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">More</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {more.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl p-2 text-center text-[10px] font-medium transition-colors',
                      active
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
