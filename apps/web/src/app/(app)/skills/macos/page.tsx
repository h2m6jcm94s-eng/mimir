'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { ClipboardList, Command, Eye, Search, Share2 } from 'lucide-react';

const capabilities = [
  {
    name: 'Shortcuts',
    icon: Command,
    tier: 1,
    description: 'Run and create Apple Shortcuts from Mimir.',
    example: 'Run my morning briefing shortcut.',
  },
  {
    name: 'AppleScript',
    icon: ClipboardList,
    tier: 1,
    description: 'Control native macOS apps via AppleScript.',
    example: 'Open Safari and search for the latest paper.',
  },
  {
    name: 'Vision',
    icon: Eye,
    tier: 0,
    description: 'On-device image analysis and OCR.',
    example: 'Describe the contents of my Downloads folder screenshot.',
  },
  {
    name: 'AirDrop',
    icon: Share2,
    tier: 1,
    description: 'Send files to nearby Apple devices.',
    example: 'AirDrop this brief to my iPhone.',
  },
  {
    name: 'Spotlight',
    icon: Search,
    tier: 0,
    description: 'Local file and metadata search.',
    example: 'Find the PDF I downloaded last Tuesday.',
  },
];

export default function MacOSSkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="macOS Skills"
        description="Native Apple capabilities — Shortcuts, AppleScript, Vision, Spotlight, AirDrop, and Continuity."
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
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
