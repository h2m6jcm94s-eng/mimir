'use client';

import { cn } from '@/lib/utils';
import {
  Accessibility,
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarCheck,
  Command,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  Library,
  Megaphone,
  Newspaper,
  Package,
  Puzzle,
  Scale,
  Settings,
  Share2,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

const primary = [
  { href: '/console', label: 'Console', icon: LayoutDashboard },
  { href: '/status', label: 'Status', icon: Activity },
  { href: '/tasks', label: 'Tasks', icon: KanbanSquare },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
];

const pa = [{ href: '/briefings', label: 'Briefings', icon: Newspaper }];

const secondary = [
  { href: '/knowledge', label: 'Knowledge', icon: Library },
  { href: '/knowledge/requests', label: 'Shared', icon: Share2 },
  { href: '/memory', label: 'Memory', icon: BrainCircuit },
  { href: '/governance', label: 'Governance', icon: Scale },
  { href: '/cost', label: 'Cost', icon: CreditCard },
];

const tertiary = [
  { href: '/skills', label: 'Skills', icon: Wand2 },
  { href: '/connectors', label: 'Connectors', icon: Puzzle },
  { href: '/routines', label: 'Routines', icon: Command },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/life-admin', label: 'Life admin', icon: CalendarCheck },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/marketplace', label: 'Marketplace', icon: Package },
  { href: '/accessibility', label: 'Accessibility', icon: Accessibility },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavGroup({ items, expanded }: { items: typeof primary; expanded: boolean }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1 px-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                'hover:bg-[var(--bg-surface-raised)]',
                active
                  ? 'bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)]',
                !expanded && 'justify-center'
              )}
              title={!expanded ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn('hidden', expanded ? 'lg:inline' : 'hidden')}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ expanded, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] transition-all duration-300 ease-expo md:flex md:w-16',
        expanded ? 'lg:w-60' : 'lg:w-16'
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white">
          <Command className="h-5 w-5" />
        </div>
        <span
          className={cn(
            'text-lg font-semibold tracking-tight text-[var(--text-primary)]',
            expanded ? 'lg:inline' : 'hidden'
          )}
        >
          Mimir
        </span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto py-4">
        <NavGroup items={primary} expanded={expanded} />
        <div className={cn('mx-3 h-px bg-[var(--border-subtle-solid)]', !expanded && 'mx-2')} />
        <NavGroup items={pa} expanded={expanded} />
        <div className={cn('mx-3 h-px bg-[var(--border-subtle-solid)]', !expanded && 'mx-2')} />
        <NavGroup items={secondary} expanded={expanded} />
        <div className={cn('mx-3 h-px bg-[var(--border-subtle-solid)]', !expanded && 'mx-2')} />
        <NavGroup items={tertiary} expanded={expanded} />
      </div>

      <div className="border-t border-[var(--border-subtle-solid)] p-3">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center justify-center rounded-md py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <span className={cn('hidden', expanded ? 'lg:inline' : 'hidden')}>Collapse</span>
          <span className={cn(expanded ? 'lg:hidden' : 'inline')}>→</span>
        </button>
      </div>
    </aside>
  );
}
