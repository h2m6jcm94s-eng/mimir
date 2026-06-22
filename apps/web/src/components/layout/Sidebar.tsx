'use client';

import { cn } from '@/lib/utils';
import {
  Accessibility,
  Activity,
  BarChart3,
  BrainCircuit,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Command,
  CreditCard,
  Dumbbell,
  Globe,
  Hammer,
  KanbanSquare,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Plane,
  Puzzle,
  Radio,
  Salad,
  Scale,
  ScreenShare,
  Settings,
  Share2,
  ShieldCheck,
  Target,
  Terminal,
  Trophy,
  UserCircle,
  UserSquare,
  Users,
  Volume2,
  Wand2,
  Workflow,
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
  { href: '/extension', label: 'Extension', icon: Globe },
  { href: '/routines', label: 'Routines', icon: Command },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
  { href: '/workflow-editor', label: 'Visual editor', icon: Workflow },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/life-admin', label: 'Life admin', icon: CalendarCheck },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/scheduling', label: 'Scheduling', icon: CalendarClock },
  { href: '/sandbox', label: 'Sandbox', icon: Terminal },
  { href: '/observability', label: 'Observability', icon: Radio },
  { href: '/tools', label: 'Tools', icon: Hammer },
  { href: '/voice', label: 'Voice', icon: Volume2 },
  { href: '/values', label: 'Values', icon: Target },
  { href: '/agents/reputation', label: 'Agent reputation', icon: UserCircle },
  { href: '/model-leaderboard', label: 'Model leaderboard', icon: Trophy },
  { href: '/modules/finance', label: 'Finance', icon: Briefcase },
  { href: '/modules/nutrition', label: 'Nutrition', icon: Salad },
  { href: '/modules/fitness', label: 'Fitness', icon: Dumbbell },
  { href: '/modules/travel', label: 'Travel', icon: Plane },
  { href: '/modules/tutor', label: 'Tutor', icon: UserSquare },
  { href: '/meetings', label: 'Meetings', icon: CalendarClock },
  { href: '/modules/email', label: 'Inbox Zero', icon: Mail },
  { href: '/screen-time', label: 'Screen time', icon: ScreenShare },
  { href: '/modules/conversation', label: 'Conversations', icon: MessageCircle },
  { href: '/modules/suggestion', label: 'Suggestions', icon: Wand2 },
  { href: '/modules/family', label: 'Family', icon: Users },
  { href: '/modules/hr', label: 'HR partner', icon: MessageSquare },
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
