'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { Apple, Monitor, Plus, Terminal, Wand2 } from 'lucide-react';
import Link from 'next/link';

const skills = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    author: 'Mimir',
    version: '1.2.0',
    tier: 0,
    description: 'Extract action items and summaries from transcripts.',
  },
  {
    id: 'email-marketing',
    name: 'Email Composer',
    author: 'Mimir',
    version: '0.9.0',
    tier: 1,
    description: 'Draft and review emails in any tone.',
  },
  {
    id: 'apple-hig',
    name: 'Apple HIG Review',
    author: 'Mimir',
    version: '2.0.0',
    tier: 0,
    description: 'Check UI against Apple Human Interface Guidelines.',
  },
];

const platforms = [
  {
    href: '/skills/macos',
    name: 'macOS',
    icon: Apple,
    color: 'text-slate-500',
    desc: 'Shortcuts, AppleScript, Vision, AirDrop',
  },
  {
    href: '/skills/linux',
    name: 'Linux',
    icon: Terminal,
    color: 'text-amber-600',
    desc: 'systemd, cron, dbus, bash, file watchers',
  },
  {
    href: '/skills/windows',
    name: 'Windows',
    icon: Monitor,
    color: 'text-blue-600',
    desc: 'PowerShell, WinRT, WSL, Task Scheduler',
  },
];

export default function SkillsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Skills"
        description="Composable capabilities. Install, build, or publish your own."
      >
        <Link
          href="/skills/builder"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New Skill
        </Link>
      </PageHeader>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Platform skills</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            return (
              <Link
                key={platform.name}
                href={platform.href}
                className="flex items-center gap-4 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
              >
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-primary)]',
                    platform.color
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    {platform.name}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">{platform.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Installed skills</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  <Wand2 className="h-5 w-5" />
                </div>
                <TierBadge tier={skill.tier as 0 | 1 | 2} />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                {skill.name}
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                {skill.author} · v{skill.version}
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{skill.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
