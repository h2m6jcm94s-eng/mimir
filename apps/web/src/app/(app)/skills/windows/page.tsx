'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { FileSpreadsheet, HardDrive, Power, Shield, Terminal, Wifi } from 'lucide-react';

const capabilities = [
  {
    name: 'PowerShell',
    icon: Terminal,
    tier: 1,
    description: 'Run PowerShell commands and scripts.',
    example: 'Get the last 20 errors from the System event log.',
  },
  {
    name: 'Excel / Office',
    icon: FileSpreadsheet,
    tier: 1,
    description: 'Read and write Office documents.',
    example: 'Summarize this spreadsheet and highlight outliers.',
  },
  {
    name: 'Defender',
    icon: Shield,
    tier: 2,
    description: 'Check Windows Security status and scans.',
    example: 'When was the last quick scan completed?',
  },
  {
    name: 'Disk & Storage',
    icon: HardDrive,
    tier: 1,
    description: 'Inspect drives, partitions, and space.',
    example: 'Which drives have less than 20% free space?',
  },
  {
    name: 'Network',
    icon: Wifi,
    tier: 1,
    description: 'Adapter, firewall, and routing diagnostics.',
    example: 'Show active network profiles and rules.',
  },
  {
    name: 'Services',
    icon: Power,
    tier: 2,
    description: 'Manage Windows services.',
    example: 'List automatic services that are not running.',
  },
];

export default function WindowsSkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Windows Skills"
        description="Enterprise and power-user Windows actions — PowerShell, Office, security, storage, and services."
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
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
