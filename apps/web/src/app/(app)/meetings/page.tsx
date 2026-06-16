'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { TierBadge } from '@/components/ui/TierBadge';
import { cn } from '@/lib/utils';
import { Calendar, CheckSquare, Clock, Users } from 'lucide-react';

const meetings = [
  {
    id: 1,
    title: 'Security Standup',
    date: 'Today, 09:00',
    duration: '15 min',
    participants: 4,
    actionItems: 2,
    tier: 0,
    transcript: true,
  },
  {
    id: 2,
    title: 'Mimir Roadmap Review',
    date: 'Today, 14:00',
    duration: '45 min',
    participants: 6,
    actionItems: 5,
    tier: 1,
    transcript: true,
  },
  {
    id: 3,
    title: 'Vendor Check-in',
    date: 'Tomorrow, 10:00',
    duration: '30 min',
    participants: 3,
    actionItems: 0,
    tier: 2,
    transcript: false,
  },
];

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Meetings" description="Transcripts, action items, and follow-ups." />

      <div className="space-y-3">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            className="flex flex-col gap-4 rounded-xl bg-[var(--bg-surface)] p-5 shadow-card transition-all duration-200 hover:shadow-hover sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {meeting.title}
                </h3>
                <TierBadge tier={meeting.tier as 0 | 1 | 2} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {meeting.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {meeting.duration}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {meeting.participants} participants
                </span>
                {meeting.actionItems > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare className="h-3.5 w-3.5" />
                    {meeting.actionItems} action items
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {meeting.transcript && (
                <button
                  type="button"
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                >
                  View transcript
                </button>
              )}
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
                )}
              >
                Prepare
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
