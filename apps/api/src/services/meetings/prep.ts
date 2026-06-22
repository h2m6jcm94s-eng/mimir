import type { TenantContext } from '../../db/tenant-context';
import {
  type PersonalModuleRow,
  getPersonalModuleById,
  listPersonalModules,
  updatePersonalModule,
} from '../../repositories/personal-modules';
import { ModelRouter } from '../models/router';

export interface MeetingItem {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: 'active' | 'done' | 'archived';
  dueAt: string | null;
  attendees: string[];
  agenda: string | null;
  prepDraft: string | null;
  followUpDraft: string | null;
  createdAt: string;
}

function toMeetingItem(row: PersonalModuleRow): MeetingItem {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const attendeesRaw = payload.attendees;
  const attendees =
    typeof attendeesRaw === 'string'
      ? attendeesRaw
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : Array.isArray(attendeesRaw)
        ? attendeesRaw.filter((a): a is string => typeof a === 'string')
        : [];

  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    attendees,
    agenda: typeof payload.agenda === 'string' ? payload.agenda : null,
    prepDraft: typeof payload.prepDraft === 'string' ? payload.prepDraft : null,
    followUpDraft: typeof payload.followUpDraft === 'string' ? payload.followUpDraft : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMeetings(
  ctx: TenantContext,
  options: { status?: 'active' | 'done' | 'archived'; limit?: number } = {}
): Promise<MeetingItem[]> {
  const rows = await listPersonalModules(ctx, {
    kind: 'meeting',
    status: options.status,
    limit: options.limit ?? 100,
  });
  return rows.map(toMeetingItem);
}

export async function getMeeting(ctx: TenantContext, id: string): Promise<MeetingItem | undefined> {
  const row = await getPersonalModuleById(ctx, id);
  if (!row || row.kind !== 'meeting') return undefined;
  return toMeetingItem(row);
}

export async function updateMeeting(
  ctx: TenantContext,
  id: string,
  input: Partial<
    Pick<
      MeetingItem,
      | 'title'
      | 'description'
      | 'status'
      | 'dueAt'
      | 'attendees'
      | 'agenda'
      | 'prepDraft'
      | 'followUpDraft'
    >
  >
): Promise<MeetingItem> {
  const existing = await getPersonalModuleById(ctx, id);
  if (!existing || existing.kind !== 'meeting') {
    const error = new Error('Meeting not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const payload = { ...(existing.payload ?? {}) } as Record<string, unknown>;
  if (input.attendees !== undefined) payload.attendees = input.attendees.join(', ');
  if (input.agenda !== undefined) payload.agenda = input.agenda;
  if (input.prepDraft !== undefined) payload.prepDraft = input.prepDraft;
  if (input.followUpDraft !== undefined) payload.followUpDraft = input.followUpDraft;

  const row = await updatePersonalModule(ctx, id, {
    title: input.title,
    description: input.description ?? undefined,
    status: input.status,
    dueAt: input.dueAt ?? undefined,
    payload,
  });
  if (!row) {
    const error = new Error('Meeting not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return toMeetingItem(row);
}

function buildPrepPrompt(meeting: MeetingItem): string {
  const attendees = meeting.attendees.length > 0 ? meeting.attendees.join(', ') : 'TBD';
  const agenda = meeting.agenda ?? 'No agenda provided';
  return `Prepare for a meeting titled "${meeting.title}" with attendees: ${attendees}. Agenda: ${agenda}. Provide a concise prep checklist, key questions, and talking points.`;
}

function buildFollowUpPrompt(meeting: MeetingItem): string {
  const attendees = meeting.attendees.length > 0 ? meeting.attendees.join(', ') : 'TBD';
  const agenda = meeting.agenda ?? 'No agenda provided';
  return `Draft a follow-up email for a meeting titled "${meeting.title}" with attendees: ${attendees}. Agenda: ${agenda}. Include a brief summary, action items, and next steps.`;
}

export async function generateMeetingPrep(
  ctx: TenantContext,
  id: string
): Promise<{ draft: string }> {
  const meeting = await getMeeting(ctx, id);
  if (!meeting) {
    const error = new Error('Meeting not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const router = new ModelRouter();
  const output = await router.invoke(
    1,
    { prompt: buildPrepPrompt(meeting), payload: {} },
    { ctx, maxTokens: 800 }
  );
  const draft = output.text ?? '';
  await updatePersonalModule(ctx, id, {
    payload: { ...((await getPersonalModuleById(ctx, id))?.payload ?? {}), prepDraft: draft },
  });
  return { draft };
}

export async function generateMeetingFollowUp(
  ctx: TenantContext,
  id: string
): Promise<{ draft: string }> {
  const meeting = await getMeeting(ctx, id);
  if (!meeting) {
    const error = new Error('Meeting not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const router = new ModelRouter();
  const output = await router.invoke(
    1,
    { prompt: buildFollowUpPrompt(meeting), payload: {} },
    { ctx, maxTokens: 800 }
  );
  const draft = output.text ?? '';
  await updatePersonalModule(ctx, id, {
    payload: { ...((await getPersonalModuleById(ctx, id))?.payload ?? {}), followUpDraft: draft },
  });
  return { draft };
}
