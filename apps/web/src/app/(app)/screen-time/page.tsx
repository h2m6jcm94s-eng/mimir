'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { PersonalModule, ScreenTimeEntry, ScreenTimeSummary } from '@mimir/shared-types';
import { Brain, Monitor, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Goal {
  id: string;
  title: string;
  app: string;
  limitMinutes: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function wellbeingTip(totalMinutes: number): string {
  const totalHours = totalMinutes / 60;
  if (totalHours > 6) {
    return 'Your screen time is high today. Try a 20-minute offline walk or a no-device meal.';
  }
  if (totalHours < 2) {
    return 'Great balance today. Keep protecting your offline time.';
  }
  return 'Steady day. A quick stretch or eye break every hour helps maintain focus.';
}

function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);

  const load = useCallback(() => {
    fetchJson<{ data: PersonalModule[] }>(
      '/api/v1/personal-modules?kind=screenTime&status=active&limit=100'
    )
      .then((res) => {
        setGoals(
          res.data.map((item) => {
            const payload = (item.payload ?? {}) as Record<string, unknown>;
            const app = String(payload.app ?? item.title ?? 'Unknown');
            const limit = Number(payload.limitMinutes ?? 60);
            return {
              id: item.id,
              title: item.title,
              app,
              limitMinutes: Number.isNaN(limit) ? 60 : limit,
            };
          })
        );
      })
      .catch(() => setGoals([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { goals };
}

function useEntries(from: string, to: string) {
  const [entries, setEntries] = useState<ScreenTimeEntry[]>([]);
  const [summary, setSummary] = useState<ScreenTimeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson<{ data: ScreenTimeEntry[] }>(
        `/api/v1/screen-time/entries?from=${from}&to=${to}&limit=500`
      ),
      fetchJson<ScreenTimeSummary>(`/api/v1/screen-time/summary?from=${from}&to=${to}`),
    ])
      .then(([entriesRes, summaryRes]) => {
        setEntries(entriesRes.data);
        setSummary(summaryRes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, summary, loading, error, refresh: load };
}

export default function ScreenTimePage() {
  const [date, setDate] = useState(today);
  const [app, setApp] = useState('');
  const [category, setCategory] = useState('');
  const [minutes, setMinutes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const days = useMemo(() => last7Days(), []);
  const { goals } = useGoals();
  const {
    entries,
    summary,
    loading,
    error,
    refresh: refreshEntries,
  } = useEntries(days[0], days[6]);

  const totalMinutes = summary?.totalMinutes ?? 0;
  const dailyTotals = summary?.dailyTotals ?? {};
  const categoryBreakdown = summary?.categoryBreakdown ?? {};
  const maxDaily = Math.max(1, ...days.map((d) => dailyTotals[d] ?? 0));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = Number(minutes);
    if (!date || Number.isNaN(parsed) || parsed < 1) return;

    fetchJson<ScreenTimeEntry>('/api/v1/screen-time/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        app: app || undefined,
        category: category || undefined,
        minutes: parsed,
      }),
    })
      .then(() => {
        setApp('');
        setCategory('');
        setMinutes('');
        refreshEntries();
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : String(err)));
  }

  function deleteEntry(id: string) {
    fetch(`/api/v1/screen-time/entries/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Delete failed');
        refreshEntries();
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : String(err)));
  }

  const displayError = error ?? formError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screen time"
        description="Track usage, compare against goals, and build digital wellbeing habits."
      />

      {displayError && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {displayError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Monitor className="h-4 w-4" />
            <span className="text-xs font-medium">Last 7 days</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {Math.round((totalMinutes / 60) * 10) / 10}h
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Brain className="h-4 w-4" />
            <span className="text-xs font-medium">Entries logged</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {summary?.entryCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Brain className="h-4 w-4" />
            <span className="text-xs font-medium">Wellbeing tip</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {wellbeingTip(totalMinutes)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card lg:col-span-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Daily usage</h3>
          <div className="mt-4 flex h-40 items-end gap-2">
            {days.map((day) => {
              const value = dailyTotals[day] ?? 0;
              const height = value > 0 ? `${(value / maxDaily) * 100}%` : '4px';
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-full rounded-t-md',
                      value > 0 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-subtle-solid)]'
                    )}
                    style={{ height }}
                    title={`${day}: ${Math.round(value)} min`}
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">{day.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Categories</h3>
          <div className="mt-4 space-y-2">
            {Object.entries(categoryBreakdown).length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">No categories yet.</p>
            )}
            {Object.entries(categoryBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([name, minutes]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{name}</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {Math.round((minutes / 60) * 10) / 10}h
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Log usage</h3>
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="screen-time-date"
          />
          <input
            type="text"
            placeholder="App / site"
            value={app}
            onChange={(e) => setApp(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="screen-time-app"
          />
          <input
            type="text"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="screen-time-category"
          />
          <input
            type="number"
            min={1}
            max={1440}
            placeholder="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="screen-time-minutes"
          />
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={!date || !minutes}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Log entry
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Goals</h3>
        {goals.length === 0 && !loading && (
          <p className="text-xs text-[var(--text-muted)]">
            Add screen-time goals in Modules → Screen time.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const spent = categoryBreakdown[goal.app] ?? 0;
            const pct = Math.min(100, Math.round((spent / goal.limitMinutes) * 100));
            const over = spent > goal.limitMinutes;
            return (
              <div
                key={goal.id}
                className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{goal.app}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {Math.round(spent)} / {goal.limitMinutes} min
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[var(--bg-surface-raised)]">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      over ? 'bg-[var(--text-danger)]' : 'bg-[var(--accent-primary)]'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {over && (
                  <p className="mt-2 text-[10px] text-[var(--text-danger)]">
                    Over daily goal by {Math.round(spent - goal.limitMinutes)} min
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Recent entries</h3>
        {loading && entries.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">Loading…</p>
        )}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No screen-time entries yet.</p>
        )}
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              data-testid={`screen-time-entry-${entry.id}`}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  {entry.app ?? 'Untracked'}
                  {entry.category && (
                    <span className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {entry.category}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {entry.date} · {entry.minutes} min
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteEntry(entry.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  'bg-[var(--text-danger)]/10 text-[var(--text-danger)] hover:bg-[var(--text-danger)]/20'
                )}
                data-testid={`screen-time-delete-${entry.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
