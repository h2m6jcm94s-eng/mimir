'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { MeetingItem, PersonalModule } from '@mimir/shared-types';
import { Calendar, Check, FileText, Loader2, Mail, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchJson<{ data: MeetingItem[] }>('/api/v1/meetings')
      .then((res) => setMeetings(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { meetings, loading, error, refresh: load };
}

export default function MeetingsPage() {
  const { meetings, loading, error, refresh } = useMeetings();
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [attendees, setAttendees] = useState('');
  const [agenda, setAgenda] = useState('');

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  function resetForm() {
    setTitle('');
    setDueAt('');
    setAttendees('');
    setAgenda('');
    setShowForm(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;

    fetchJson<PersonalModule>('/api/v1/personal-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'meeting',
        title,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        payload: {
          attendees,
          agenda,
        },
      }),
    })
      .then(() => {
        resetForm();
        refresh();
      })
      .catch((err) => setDraftError(err instanceof Error ? err.message : String(err)));
  }

  function generateDraft(id: string, type: 'prep' | 'follow-up') {
    setGeneratingId(id);
    setDraftError(null);
    fetchJson<{ draft: string }>(`/api/v1/meetings/${id}/${type}`, { method: 'POST' })
      .then(() => refresh())
      .catch((err) => setDraftError(err instanceof Error ? err.message : String(err)))
      .finally(() => setGeneratingId(null));
  }

  function markDone(id: string) {
    fetchJson<MeetingItem>(`/api/v1/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
      .then(() => refresh())
      .catch((err) => setDraftError(err instanceof Error ? err.message : String(err)));
  }

  function deleteMeeting(id: string) {
    fetch(`/api/v1/personal-modules/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Delete failed');
        refresh();
      })
      .catch((err) => setDraftError(err instanceof Error ? err.message : String(err)));
  }

  const displayError = error ?? draftError;

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings" description="Prepare for meetings and draft follow-ups.">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New meeting
        </button>
      </PageHeader>

      {displayError && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {displayError}
        </div>
      )}

      {showForm && (
        <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Add meeting</h3>
          <form onSubmit={handleCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Meeting title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              data-testid="meeting-title"
            />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              data-testid="meeting-date"
            />
            <input
              type="text"
              placeholder="Attendees (comma-separated)"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
              data-testid="meeting-attendees"
            />
            <textarea
              placeholder="Agenda / notes"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="h-20 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
              data-testid="meeting-agenda"
            />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={!title}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
                )}
              >
                <Plus className="h-3.5 w-3.5" /> Add meeting
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                )}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3" data-testid="meeting-list">
        {loading && meetings.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">Loading…</p>
        )}
        {!loading && meetings.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No meetings yet.</p>
        )}

        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
            data-testid={`meeting-card-${meeting.title}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {meeting.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  {meeting.dueAt && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(meeting.dueAt)}
                    </span>
                  )}
                  {meeting.attendees.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {meeting.attendees.join(', ')}
                    </span>
                  )}
                </div>
                {meeting.agenda && (
                  <p className="text-xs text-[var(--text-secondary)]">{meeting.agenda}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => generateDraft(meeting.id, 'prep')}
                  disabled={generatingId === meeting.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                  data-testid={`meeting-prep-${meeting.id}`}
                >
                  {generatingId === meeting.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Prep
                </button>
                <button
                  type="button"
                  onClick={() => generateDraft(meeting.id, 'follow-up')}
                  disabled={generatingId === meeting.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                  data-testid={`meeting-follow-up-${meeting.id}`}
                >
                  {generatingId === meeting.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  Follow-up
                </button>
                <button
                  type="button"
                  onClick={() => markDone(meeting.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--accent-success)]/10 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/20'
                  )}
                  data-testid={`meeting-done-${meeting.id}`}
                >
                  <Check className="h-3.5 w-3.5" /> Done
                </button>
                <button
                  type="button"
                  onClick={() => deleteMeeting(meeting.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    'bg-[var(--text-danger)]/10 text-[var(--text-danger)] hover:bg-[var(--text-danger)]/20'
                  )}
                  data-testid={`meeting-delete-${meeting.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {meeting.prepDraft && (
              <div className="mt-3 rounded-lg bg-[var(--bg-surface-raised)] p-3">
                <h4 className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Prep notes
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                  {meeting.prepDraft}
                </p>
              </div>
            )}

            {meeting.followUpDraft && (
              <div className="mt-3 rounded-lg bg-[var(--bg-surface-raised)] p-3">
                <h4 className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Follow-up draft
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                  {meeting.followUpDraft}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
