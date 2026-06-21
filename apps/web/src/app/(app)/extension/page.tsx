'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Check, Download, Globe, Puzzle } from 'lucide-react';

const steps = [
  'Build the extension with pnpm --filter @mimir/extension build.',
  'Open Chrome/Edge and go to chrome://extensions.',
  'Enable Developer mode in the top-right corner.',
  'Click Load unpacked and select apps/extension/dist.',
  'Pin the Mimir extension to your toolbar and click it to capture pages.',
];

const features = [
  'Clip full pages or selected text into your knowledge base',
  'Capture screenshots with automatic citation links',
  'Right-click any selection to add it to Mimir',
  'Keyboard shortcut Ctrl/Cmd + Shift + M for instant capture',
];

export default function ExtensionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Browser extension"
        description="Capture the web into your second brain with one click."
      >
        <a
          href="/extension/mimir-extension.zip"
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
        >
          <Download className="h-3.5 w-3.5" /> Download extension
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature}
            className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
          >
            <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <p className="text-xs text-[var(--text-secondary)]">{feature}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
          Installation
        </h3>
        <ol className="list-decimal space-y-2 pl-4 text-xs text-[var(--text-secondary)]">
          {steps.map((step) => (
            <li key={step} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-[var(--accent-success)]/20 bg-[var(--accent-success)]/10 px-3 py-2 text-xs text-[var(--accent-success)]">
        <Check className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
        The extension reuses your existing Mimir session cookie, so no extra sign-in is required.
      </div>
    </div>
  );
}
