import { z } from 'zod';

export const MeetingItem = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'done', 'archived']),
  dueAt: z.string().datetime().nullable(),
  attendees: z.array(z.string()),
  agenda: z.string().nullable(),
  prepDraft: z.string().nullable(),
  followUpDraft: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type MeetingItem = z.infer<typeof MeetingItem>;

export const MeetingListResponse = z.object({
  data: z.array(MeetingItem),
});
export type MeetingListResponse = z.infer<typeof MeetingListResponse>;

export const UpdateMeetingRequest = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['active', 'done', 'archived']).optional(),
  dueAt: z.string().datetime().optional(),
  attendees: z.array(z.string()).optional(),
  agenda: z.string().optional(),
  prepDraft: z.string().optional(),
  followUpDraft: z.string().optional(),
});
export type UpdateMeetingRequest = z.infer<typeof UpdateMeetingRequest>;

export const MeetingDraftResponse = z.object({
  draft: z.string(),
});
export type MeetingDraftResponse = z.infer<typeof MeetingDraftResponse>;
