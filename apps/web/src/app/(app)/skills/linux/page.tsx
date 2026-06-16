'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { Cpu, FileCode, FolderOpen, Globe, Lock, Terminal } from 'lucide-react';

const capabilities = [
  {
    name: 'Shell',
    icon: Terminal,
    tier: 1,
    description: 'Run Bash/Zsh/Fish commands in a sandboxed shell.',
    example: 'List the 10 largest files in /var/log.',
  },
  {
    name: 'Scripts',
    icon: FileCode,
    tier: 1,
    description: 'Execute Python, Node, or Ruby scripts locally.',
    example: 'Run the data cleanup script in ~/scripts.',
  },
  {
    name: 'Systemctl',
    icon: Cpu,
    tier: 2,
    description: 'Inspect and manage systemd units.',
    example: 'Show me failed services from the last boot.',
  },
  {
    name: 'Firewall',
    icon: Lock,
    tier: 2,
    description: 'Review iptables/nftables/ufw rules.',
    example: 'Summarize active firewall rules.',
  },
  {
    name: 'Network',
    icon: Globe,
    tier: 1,
    description: 'Check connectivity, interfaces, and routing.',
    example: 'Which ports are listening on this machine?',
  },
  {
    name: 'Filesystem',
    icon: FolderOpen,
    tier: 0,
    description: 'Indexed local search and metadata.',
    example: 'Find every markdown file modified this week.',
  },
];

export default function LinuxSkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Linux Skills"
        description="Power-user tooling for desktop and server Linux — shell, scripts, systemd, network, and security."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.name}
              className="rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Icon className="h-6 w-6" />
                </div>
                <TierBadge tier={cap.tier as 0 | 1 | 2} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                {cap.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{cap.description}</p>
              <div className="mt-3 rounded-lg bg-[var(--bg-primary)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Example prompt</p>
                <p className="mt-1 text-sm italic text-[var(--text-secondary)]">“{cap.example}”</p>
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Enabled</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-[var(--border-subtle-solid)] text-[var(--accent-primary)]"
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
