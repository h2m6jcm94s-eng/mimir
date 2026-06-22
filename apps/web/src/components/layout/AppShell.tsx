'use client';

import { type PersonalModuleKind, moduleConfigs } from '@/lib/module-config';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { BottomNav } from './BottomNav';
import { CommandPalette } from './CommandPalette';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const pageTitles: Record<string, string> = {
  '/': 'Console',
  '/console': 'Console',
  '/status': 'Status',
  '/tasks': 'Tasks',
  '/approvals': 'Approvals',
  '/briefings': 'Briefings',
  '/meetings': 'Meetings',
  '/emails': 'Emails',
  '/extension': 'Browser extension',
  '/knowledge': 'Knowledge',
  '/memory': 'Memory',
  '/governance': 'Governance',
  '/cost': 'Cost',
  '/connectors': 'Connectors',
  '/routines': 'Routines',
  '/reports': 'Reports',
  '/workflow-editor': 'Workflow visual editor',
  '/marketplace': 'Marketplace',
  '/agents/reputation': 'Agent reputation',
  '/model-leaderboard': 'Model leaderboard',
  '/notifications': 'Notifications',
  '/observability': 'Observability',
  '/skills': 'Skills',
  '/skills/builder': 'Skill Builder',
  '/skills/macos': 'macOS Skills',
  '/skills/linux': 'Linux Skills',
  '/skills/windows': 'Windows Skills',
  '/tools': 'Tools',
  '/voice': 'Voice companion',
  '/accessibility': 'Accessibility',
  '/sandbox': 'Sandbox playground',
  '/remediation': 'Self-healing',
  '/settings': 'Settings',
};

interface AppShellProps {
  children: React.ReactNode;
}

function resolvePageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const moduleMatch = pathname.match(/^\/modules\/([^/]+)$/);
  if (moduleMatch) {
    const kind = moduleMatch[1] as PersonalModuleKind;
    const config = moduleConfigs[kind];
    if (config) return config.title;
  }
  return 'Mimir';
}

export function AppShell({ children }: AppShellProps) {
  const [expanded, setExpanded] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  const handleSearchClick = useCallback(() => setPaletteOpen(true), []);

  return (
    <div className={cn('flex min-h-screen bg-[var(--bg-primary)] pb-16 sm:pb-0')}>
      <Sidebar expanded={expanded} onToggle={() => setExpanded((p) => !p)} />

      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300 ease-expo',
          'md:ml-16',
          expanded ? 'lg:ml-60' : 'lg:ml-16'
        )}
      >
        <TopBar pageTitle={resolvePageTitle(pathname)} onSearchClick={handleSearchClick} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        <Footer className="hidden sm:flex" />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <BottomNav />
    </div>
  );
}
