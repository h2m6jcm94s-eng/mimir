import { z } from 'zod';

export const SessionMessage = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  model: z.string().optional(),
  tier: z.number().int(),
  costUsd: z.number().int().optional(),
  sources: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type SessionMessage = z.infer<typeof SessionMessage>;

export const SessionState = z.object({
  session: z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().optional(),
    source: z.string(),
    model: z.string().optional(),
    createdAt: z.string().datetime(),
  }),
  messages: z.array(SessionMessage),
});
export type SessionState = z.infer<typeof SessionState>;

export const ActiveSession = z.object({
  id: z.string().uuid(),
  source: z.string(),
  model: z.string().optional(),
  lastMessageAt: z.string().datetime(),
  messageCount: z.number().int(),
});
export type ActiveSession = z.infer<typeof ActiveSession>;

export const ActiveSessionsResponse = z.object({
  data: z.array(ActiveSession),
});
export type ActiveSessionsResponse = z.infer<typeof ActiveSessionsResponse>;
