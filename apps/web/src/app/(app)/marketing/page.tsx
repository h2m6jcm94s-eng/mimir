'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  CalendarDays,
  Loader2,
  Megaphone,
  Palette,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';
type CalendarStatus = 'draft' | 'scheduled' | 'published';
type Platform = 'blog' | 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'email' | 'ad';

interface BrandVoice {
  id: string;
  name: string;
  tone: string;
  audience: string;
  guidelines: string;
  sampleText: string;
  isDefault: boolean;
}

interface Campaign {
  id: string;
  brandVoiceId: string | null;
  name: string;
  goal: string;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  metrics: { impressions: number; clicks: number; conversions: number };
}

interface CalendarItem {
  id: string;
  campaignId: string | null;
  title: string;
  body: string;
  platform: Platform;
  scheduledAt: string | null;
  status: CalendarStatus;
}

interface Analytics {
  campaigns: { total: number; active: number; completed: number };
  calendar: { total: number; scheduled: number; published: number };
  totals: { impressions: number; clicks: number; conversions: number };
}

const platforms: { value: Platform; label: string }[] = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'blog', label: 'Blog' },
  { value: 'email', label: 'Email' },
  { value: 'ad', label: 'Ad' },
];

const campaignStatuses: CampaignStatus[] = ['draft', 'active', 'completed', 'archived'];
const calendarStatuses: CalendarStatus[] = ['draft', 'scheduled', 'published'];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClasses(status: string) {
  switch (status) {
    case 'active':
    case 'scheduled':
      return 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]';
    case 'completed':
    case 'published':
      return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]';
    case 'archived':
      return 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]';
    default:
      return 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]';
  }
}

export default function MarketingPage() {
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'voices' | 'campaigns' | 'calendar'>('voices');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [voiceForm, setVoiceForm] = useState({
    name: '',
    tone: '',
    audience: '',
    guidelines: '',
    sampleText: '',
    isDefault: false,
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    goal: '',
    status: 'draft' as CampaignStatus,
    budget: '',
    brandVoiceId: '',
    startDate: '',
    endDate: '',
  });

  const [calendarForm, setCalendarForm] = useState({
    title: '',
    platform: 'twitter' as Platform,
    campaignId: '',
    scheduledAt: '',
    status: 'draft' as CalendarStatus,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [voicesRes, campaignsRes, calendarRes, analyticsRes] = await Promise.all([
        fetchJson<{ data: BrandVoice[] }>('/api/v1/marketing/brand-voices'),
        fetchJson<{ data: Campaign[] }>('/api/v1/marketing/campaigns'),
        fetchJson<{ data: CalendarItem[] }>('/api/v1/marketing/calendar'),
        fetchJson<{ data: Analytics }>('/api/v1/marketing/analytics'),
      ]);
      setVoices(voicesRes.data);
      setCampaigns(campaignsRes.data);
      setCalendar(calendarRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const campaignsById = useMemo(() => {
    const map = new Map<string, Campaign>();
    for (const c of campaigns) map.set(c.id, c);
    return map;
  }, [campaigns]);

  function addVoice(e: React.FormEvent) {
    e.preventDefault();
    if (!voiceForm.name) return;
    fetchJson<{ data: BrandVoice }>('/api/v1/marketing/brand-voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: voiceForm.name,
        tone: voiceForm.tone,
        audience: voiceForm.audience,
        guidelines: voiceForm.guidelines,
        sampleText: voiceForm.sampleText,
        isDefault: voiceForm.isDefault,
      }),
    })
      .then(() => {
        setVoiceForm({
          name: '',
          tone: '',
          audience: '',
          guidelines: '',
          sampleText: '',
          isDefault: false,
        });
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function addCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignForm.name) return;
    fetchJson<{ data: Campaign }>('/api/v1/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignForm.name,
        goal: campaignForm.goal,
        status: campaignForm.status,
        budget: campaignForm.budget ? Number(campaignForm.budget) : undefined,
        brandVoiceId: campaignForm.brandVoiceId || undefined,
        startDate: campaignForm.startDate
          ? new Date(campaignForm.startDate).toISOString()
          : undefined,
        endDate: campaignForm.endDate ? new Date(campaignForm.endDate).toISOString() : undefined,
      }),
    })
      .then(() => {
        setCampaignForm({
          name: '',
          goal: '',
          status: 'draft',
          budget: '',
          brandVoiceId: '',
          startDate: '',
          endDate: '',
        });
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function addCalendarItem(e: React.FormEvent) {
    e.preventDefault();
    if (!calendarForm.title) return;
    fetchJson<{ data: CalendarItem }>('/api/v1/marketing/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: calendarForm.title,
        platform: calendarForm.platform,
        campaignId: calendarForm.campaignId || undefined,
        scheduledAt: calendarForm.scheduledAt
          ? new Date(calendarForm.scheduledAt).toISOString()
          : undefined,
        status: calendarForm.status,
      }),
    })
      .then(() => {
        setCalendarForm({
          title: '',
          platform: 'twitter',
          campaignId: '',
          scheduledAt: '',
          status: 'draft',
        });
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function generateDraft(item: CalendarItem) {
    setGeneratingId(item.id);
    fetchJson<{ data: CalendarItem }>(`/api/v1/marketing/calendar/${item.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: item.title }),
    })
      .then(() => loadAll())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setGeneratingId(null));
  }

  function deleteVoice(id: string) {
    fetch(`/api/v1/marketing/brand-voices/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function deleteCampaign(id: string) {
    fetch(`/api/v1/marketing/campaigns/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function deleteCalendarItem(id: string) {
    fetch(`/api/v1/marketing/calendar/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadAll();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Brand voices, campaigns, and a content calendar for your agency."
      >
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('marketing-form');
            el?.scrollIntoView({ behavior: 'smooth' });
            el?.querySelector('input')?.focus();
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          <Plus className="h-3.5 w-3.5" /> New item
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="marketing-analytics">
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Megaphone className="h-4 w-4" />
              <span className="text-xs font-medium">Campaigns</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {analytics.campaigns.total}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {analytics.campaigns.active} active · {analytics.campaigns.completed} completed
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-medium">Calendar</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {analytics.calendar.total}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {analytics.calendar.scheduled} scheduled · {analytics.calendar.published} published
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Conversions</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {analytics.totals.conversions}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {analytics.totals.clicks} clicks · {analytics.totals.impressions} impressions
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Palette className="h-4 w-4" />
              <span className="text-xs font-medium">Brand voices</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {voices.length}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {voices.filter((v) => v.isDefault).length} default
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-[var(--border-subtle-solid)]">
        {(
          [
            { key: 'voices', label: 'Brand voices' },
            { key: 'campaigns', label: 'Campaigns' },
            { key: 'calendar', label: 'Content calendar' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            data-testid={`marketing-tab-${tab.key}`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--accent-primary)]" />
            )}
          </button>
        ))}
      </div>

      <section
        id="marketing-form"
        className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
      >
        {activeTab === 'voices' && (
          <form onSubmit={addVoice} className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Add brand voice</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Voice name"
                value={voiceForm.name}
                onChange={(e) => setVoiceForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-voice-name"
              />
              <input
                type="text"
                placeholder="Tone (e.g. playful professional)"
                value={voiceForm.tone}
                onChange={(e) => setVoiceForm((f) => ({ ...f, tone: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-voice-tone"
              />
              <input
                type="text"
                placeholder="Audience"
                value={voiceForm.audience}
                onChange={(e) => setVoiceForm((f) => ({ ...f, audience: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-voice-audience"
              />
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={voiceForm.isDefault}
                  onChange={(e) => setVoiceForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--border-subtle-solid)]"
                  data-testid="marketing-voice-default"
                />
                Make default voice
              </label>
              <textarea
                placeholder="Guidelines"
                value={voiceForm.guidelines}
                onChange={(e) => setVoiceForm((f) => ({ ...f, guidelines: e.target.value }))}
                className="h-20 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
                data-testid="marketing-voice-guidelines"
              />
              <textarea
                placeholder="Sample copy"
                value={voiceForm.sampleText}
                onChange={(e) => setVoiceForm((f) => ({ ...f, sampleText: e.target.value }))}
                className="h-20 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
                data-testid="marketing-voice-sample"
              />
            </div>
            <button
              type="submit"
              disabled={!voiceForm.name}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
              data-testid="marketing-add-voice"
            >
              <Plus className="h-3.5 w-3.5" /> Add voice
            </button>
          </form>
        )}

        {activeTab === 'campaigns' && (
          <form onSubmit={addCampaign} className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Add campaign</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Campaign name"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-name"
              />
              <select
                value={campaignForm.status}
                onChange={(e) =>
                  setCampaignForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))
                }
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-status"
              >
                {campaignStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={campaignForm.brandVoiceId}
                onChange={(e) => setCampaignForm((f) => ({ ...f, brandVoiceId: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-voice"
              >
                <option value="">No brand voice</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Budget (USD)"
                value={campaignForm.budget}
                onChange={(e) => setCampaignForm((f) => ({ ...f, budget: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-budget"
              />
              <input
                type="date"
                value={campaignForm.startDate}
                onChange={(e) => setCampaignForm((f) => ({ ...f, startDate: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-start"
              />
              <input
                type="date"
                value={campaignForm.endDate}
                onChange={(e) => setCampaignForm((f) => ({ ...f, endDate: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-campaign-end"
              />
              <textarea
                placeholder="Goal"
                value={campaignForm.goal}
                onChange={(e) => setCampaignForm((f) => ({ ...f, goal: e.target.value }))}
                className="h-20 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
                data-testid="marketing-campaign-goal"
              />
            </div>
            <button
              type="submit"
              disabled={!campaignForm.name}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
              data-testid="marketing-add-campaign"
            >
              <Plus className="h-3.5 w-3.5" /> Add campaign
            </button>
          </form>
        )}

        {activeTab === 'calendar' && (
          <form onSubmit={addCalendarItem} className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Add calendar item</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Title / topic"
                value={calendarForm.title}
                onChange={(e) => setCalendarForm((f) => ({ ...f, title: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-calendar-title"
              />
              <select
                value={calendarForm.platform}
                onChange={(e) =>
                  setCalendarForm((f) => ({ ...f, platform: e.target.value as Platform }))
                }
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-calendar-platform"
              >
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={calendarForm.campaignId}
                onChange={(e) => setCalendarForm((f) => ({ ...f, campaignId: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-calendar-campaign"
              >
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={calendarForm.status}
                onChange={(e) =>
                  setCalendarForm((f) => ({ ...f, status: e.target.value as CalendarStatus }))
                }
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                data-testid="marketing-calendar-status"
              >
                {calendarStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={calendarForm.scheduledAt}
                onChange={(e) => setCalendarForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
                data-testid="marketing-calendar-scheduled"
              />
            </div>
            <button
              type="submit"
              disabled={!calendarForm.title}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
              )}
              data-testid="marketing-add-calendar"
            >
              <Plus className="h-3.5 w-3.5" /> Add to calendar
            </button>
          </form>
        )}
      </section>

      {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

      {activeTab === 'voices' && (
        <div className="space-y-3" data-testid="marketing-voices-list">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              data-testid={`marketing-voice-${voice.name}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-[var(--accent-primary)]" />
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {voice.name}
                    </h4>
                    {voice.isDefault && (
                      <span className="rounded-full bg-[var(--accent-success)]/10 px-2 py-0.5 text-[10px] text-[var(--accent-success)]">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">Tone:</span>{' '}
                    {voice.tone || '—'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">Audience:</span>{' '}
                    {voice.audience || '—'}
                  </p>
                  {voice.guidelines && (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">{voice.guidelines}</p>
                  )}
                  {voice.sampleText && (
                    <p className="mt-2 border-l-2 border-[var(--border-subtle-solid)] pl-3 text-xs italic text-[var(--text-muted)]">
                      “{voice.sampleText}”
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteVoice(voice.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-danger)] hover:bg-[var(--text-danger)]/10"
                  data-testid={`marketing-delete-voice-${voice.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!loading && voices.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No brand voices yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="space-y-3" data-testid="marketing-campaigns-list">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              data-testid={`marketing-campaign-${campaign.name}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Megaphone className="h-4 w-4 text-[var(--accent-primary)]" />
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {campaign.name}
                    </h4>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                        statusClasses(campaign.status)
                      )}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {campaign.goal || 'No goal set.'}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="rounded-lg bg-[var(--bg-surface-raised)] p-2">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {campaign.metrics.impressions}
                      </p>
                      <p className="text-[var(--text-muted)]">Impressions</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-raised)] p-2">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {campaign.metrics.clicks}
                      </p>
                      <p className="text-[var(--text-muted)]">Clicks</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface-raised)] p-2">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {campaign.metrics.conversions}
                      </p>
                      <p className="text-[var(--text-muted)]">Conversions</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCampaign(campaign.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-danger)] hover:bg-[var(--text-danger)]/10"
                  data-testid={`marketing-delete-campaign-${campaign.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!loading && campaigns.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No campaigns yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-3" data-testid="marketing-calendar-list">
          {calendar.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              data-testid={`marketing-calendar-${item.title}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[var(--accent-primary)]" />
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {item.title}
                    </h4>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                        statusClasses(item.status)
                      )}
                    >
                      {item.status}
                    </span>
                    <span className="rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      {item.platform}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    {formatDate(item.scheduledAt)}
                  </p>
                  {item.campaignId && (
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                      Campaign: {campaignsById.get(item.campaignId)?.name ?? item.campaignId}
                    </p>
                  )}
                  {item.body && (
                    <div className="mt-3 rounded-lg bg-[var(--bg-surface-raised)] p-3">
                      <p className="whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                        {item.body}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => generateDraft(item)}
                    disabled={generatingId === item.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20'
                    )}
                    data-testid={`marketing-generate-${item.id}`}
                  >
                    {generatingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCalendarItem(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-danger)] hover:bg-[var(--text-danger)]/10"
                    data-testid={`marketing-delete-calendar-${item.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && calendar.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No calendar items yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
