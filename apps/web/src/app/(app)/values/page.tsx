'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ValueStatement {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface DecisionOption {
  label: string;
  description: string;
}

interface Decision {
  id: string;
  title: string;
  context: string;
  options: DecisionOption[];
  chosenOption: string;
  valueIds: string[];
  decidedAt: string;
}

interface DecisionOutcome {
  id: string;
  decisionId: string;
  outcome: string;
  alignmentScore?: number;
  notes: string;
  recordedAt: string;
}

type Tab = 'values' | 'decisions' | 'outcomes';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ValuesPage() {
  const [tab, setTab] = useState<Tab>('values');
  const [values, setValues] = useState<ValueStatement[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [outcomes, setOutcomes] = useState<DecisionOutcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadValues = useCallback(() => {
    return fetchJson<{ data: ValueStatement[] }>('/api/v1/values').then((res) =>
      setValues(res.data)
    );
  }, []);

  const loadDecisions = useCallback(() => {
    return fetchJson<{ data: Decision[] }>('/api/v1/values/decisions').then((res) =>
      setDecisions(res.data)
    );
  }, []);

  const loadOutcomes = useCallback(async () => {
    const all: DecisionOutcome[] = [];
    for (const decision of decisions) {
      const res = await fetchJson<{ data: { outcomes: DecisionOutcome[] } }>(
        `/api/v1/values/decisions/${decision.id}`
      );
      all.push(...res.data.outcomes);
    }
    setOutcomes(all);
  }, [decisions]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadValues(), loadDecisions()])
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [loadValues, loadDecisions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab === 'outcomes' && decisions.length > 0) {
      loadOutcomes();
    }
  }, [tab, decisions, loadOutcomes]);

  async function createValue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    await fetchJson<{ data: ValueStatement }>('/api/v1/values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        description: data.get('description') || '',
        weight: Number(data.get('weight')),
      }),
    });
    form.reset();
    await loadValues();
  }

  async function archiveValue(id: string) {
    await fetchJson(`/api/v1/values/${id}`, { method: 'DELETE' });
    await loadValues();
  }

  async function createDecision(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const options = (data.get('options') as string)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, description: '' }));
    const valueIds = values
      .filter((_, index) => data.get(`value-${index}`) === 'on')
      .map((v) => v.id);

    await fetchJson<{ data: Decision }>('/api/v1/values/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'),
        context: data.get('context') || '',
        options,
        chosenOption: data.get('chosenOption'),
        valueIds,
      }),
    });
    form.reset();
    await loadDecisions();
    setTab('decisions');
  }

  async function createOutcome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const decisionId = data.get('decisionId') as string;
    await fetchJson<{ data: DecisionOutcome }>(`/api/v1/values/decisions/${decisionId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: data.get('outcome'),
        alignmentScore: data.get('alignmentScore') ? Number(data.get('alignmentScore')) : undefined,
        notes: data.get('notes') || '',
      }),
    });
    form.reset();
    await loadOutcomes();
  }

  async function updateWeight(id: string, weight: number) {
    await fetchJson<{ data: ValueStatement }>(`/api/v1/values/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight }),
    });
    await loadValues();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Values & decisions" />

      <div className="flex gap-2 border-b border-[var(--border-subtle-solid)]">
        {(
          [
            { key: 'values', label: 'Values' },
            { key: 'decisions', label: 'Decisions' },
            { key: 'outcomes', label: 'Outcomes' },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium',
              tab === key
                ? 'border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-[var(--text-muted)]">Loading…</div>}

      {tab === 'values' && (
        <div className="space-y-6">
          <form onSubmit={createValue} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Add a value</h3>
            <input
              name="name"
              required
              placeholder="e.g. Health, Family, Growth"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <textarea
              name="description"
              placeholder="What does this value mean to you?"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <label htmlFor="value-weight" className="text-sm">
                Weight
              </label>
              <input
                id="value-weight"
                name="weight"
                type="range"
                min={1}
                max={10}
                defaultValue={5}
                className="flex-1"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add value
            </button>
          </form>

          <div className="space-y-3">
            {values.map((value) => (
              <div
                key={value.id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div>
                  <h4 className="font-medium">{value.name}</h4>
                  {value.description && (
                    <p className="text-sm text-[var(--text-muted)]">{value.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span>Weight</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={value.weight}
                      onChange={(e) => updateWeight(value.id, Number(e.target.value))}
                    />
                    <span>{value.weight}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => archiveValue(value.id)}
                  className="text-[var(--text-muted)] hover:text-red-500"
                  title="Archive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!loading && values.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No values yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'decisions' && (
        <div className="space-y-6">
          <form onSubmit={createDecision} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Log a decision</h3>
            <input
              name="title"
              required
              placeholder="What did you decide?"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <textarea
              name="context"
              placeholder="Context or trade-offs..."
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <textarea
              name="options"
              required
              placeholder="Options (one per line)"
              rows={3}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <input
              name="chosenOption"
              required
              placeholder="Chosen option"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <div className="space-y-1">
              <span className="text-sm">Relevant values</span>
              <div className="flex flex-wrap gap-3">
                {values.map((value, index) => (
                  <label key={value.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name={`value-${index}`} />
                    {value.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Log decision
            </button>
          </form>

          <div className="space-y-3">
            {decisions.map((decision) => (
              <div key={decision.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{decision.title}</h4>
                    <p className="text-sm text-[var(--text-muted)]">
                      {formatDate(decision.decidedAt)}
                    </p>
                  </div>
                </div>
                {decision.context && (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{decision.context}</p>
                )}
                <div className="mt-2 text-sm">
                  <span className="font-medium">Chosen:</span> {decision.chosenOption}
                </div>
                {decision.valueIds.length > 0 && (
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    Values:{' '}
                    {values
                      .filter((v) => decision.valueIds.includes(v.id))
                      .map((v) => v.name)
                      .join(', ')}
                  </div>
                )}
              </div>
            ))}
            {!loading && decisions.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No decisions logged yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'outcomes' && (
        <div className="space-y-6">
          <form onSubmit={createOutcome} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Record an outcome</h3>
            <select
              name="decisionId"
              required
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">Select decision</option>
              {decisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <textarea
              name="outcome"
              required
              placeholder="What happened?"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <input
              name="alignmentScore"
              type="number"
              min={1}
              max={10}
              placeholder="Alignment score (1-10)"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <textarea
              name="notes"
              placeholder="Notes"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Record outcome
            </button>
          </form>

          <div className="space-y-3">
            {outcomes.map((outcome) => {
              const decision = decisions.find((d) => d.id === outcome.decisionId);
              return (
                <div key={outcome.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{decision?.title ?? 'Unknown decision'}</h4>
                    {outcome.alignmentScore && (
                      <span className="rounded-full bg-[var(--bg-surface-raised)] px-2 py-1 text-xs font-medium">
                        {outcome.alignmentScore}/10
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{outcome.outcome}</p>
                  {outcome.notes && (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{outcome.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDate(outcome.recordedAt)}
                  </p>
                </div>
              );
            })}
            {!loading && outcomes.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No outcomes recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
