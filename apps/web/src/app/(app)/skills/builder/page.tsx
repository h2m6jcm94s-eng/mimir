'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { SkillDraft } from '@mimir/shared-types';
import { Loader2, Play, Rocket, Save, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export default function SkillBuilderPage() {
  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<SkillDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<SkillDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, []);

  async function loadDrafts() {
    try {
      const res = await fetchJson<{ data: SkillDraft[] }>('/api/v1/skills/drafts');
      setDrafts(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ data: SkillDraft }>('/api/v1/skills/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      setActiveDraft(res.data);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!activeDraft) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetchJson<{ data: SkillDraft }>(
        `/api/v1/skills/drafts/${activeDraft.id}/publish`,
        { method: 'POST' }
      );
      setActiveDraft(res.data);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Builder"
        description="Describe what you want, let the agent generate a reusable skill, then publish it to the marketplace."
      >
        <button
          type="button"
          disabled={!activeDraft || activeDraft.status === 'published'}
          onClick={handlePublish}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
          )}
        >
          {publishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          Publish
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <form
            onSubmit={handleGenerate}
            className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card"
          >
            <label
              htmlFor="skill-prompt"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Describe the skill you want
            </label>
            <textarea
              id="skill-prompt"
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              placeholder="e.g. A skill that reads my daily tasks and drafts a stand-up update."
              rows={5}
              data-testid="skill-prompt"
              className="mt-2 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)]"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              data-testid="skill-generate"
              className={cn(
                'mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate skill
            </button>
          </form>

          <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Your drafts</h4>
            {drafts.length === 0 && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">No drafts yet.</p>
            )}
            <ul className="mt-2 space-y-2">
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <button
                    type="button"
                    onClick={() => setActiveDraft(draft)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle-solid)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--accent-primary)]',
                      activeDraft?.id === draft.id &&
                        'border-[var(--accent-primary)] bg-[var(--bg-surface-raised)]'
                    )}
                  >
                    <span className="truncate">{draft.name}</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px]',
                        draft.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      )}
                    >
                      {draft.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {activeDraft ? (
            <>
              <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {activeDraft.name}
                  </h3>
                  <span
                    data-testid="skill-draft-status"
                    className="text-xs text-[var(--text-muted)]"
                  >
                    {activeDraft.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{activeDraft.description}</p>
              </div>

              <div className="flex-1 rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Generated code
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">TypeScript</span>
                </div>
                <pre
                  data-testid="skill-generated-code"
                  className="h-80 w-full overflow-auto rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4 font-mono text-xs leading-relaxed"
                >
                  {activeDraft.code ?? '// No code generated'}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-[var(--bg-surface)] p-8 text-sm text-[var(--text-muted)] shadow-card">
              <div className="text-center">
                <Wand2 className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                <p>Describe a skill and generate a draft to see it here.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
