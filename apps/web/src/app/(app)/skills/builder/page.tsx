'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { Play, Save, Wand2 } from 'lucide-react';
import { useState } from 'react';

export default function SkillBuilderPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState(`// Define what your skill does.
// Triggers, actions, and outputs are composable blocks.

export default defineSkill({
  name: 'my-skill',
  triggers: [{ type: 'command', value: '/my-skill' }],
  actions: [
    { type: 'classify', tier: 0 },
    { type: 'prompt', model: 'kimi' },
  ],
  outputs: ['text', 'task'],
});
`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Builder"
        description="Compose triggers, actions, and outputs into a reusable skill."
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <label
              htmlFor="skill-name"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Skill name
            </label>
            <input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. meeting-notes"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Blocks</h4>
            <div className="mt-3 space-y-2">
              {['Trigger', 'Classify', 'Prompt', 'Review', 'Apply', 'Output'].map((block) => (
                <button
                  key={block}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle-solid)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {block}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Default tier</h4>
            <div className="mt-3 flex gap-2">
              <TierBadge tier={0} />
              <TierBadge tier={1} />
              <TierBadge tier={2} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex-1 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Code</span>
              <span className="text-[10px] text-[var(--text-muted)]">TypeScript</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-80 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 font-mono text-xs leading-relaxed outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Test panel</h4>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                )}
              >
                <Play className="h-3 w-3" />
                Run
              </button>
            </div>
            <div className="rounded-lg border border-dashed border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-muted)]">
              Provide sample input and run the skill to see output here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
