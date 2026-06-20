import { z } from 'zod';

export const EmailDigestFrequency = z.enum(['daily', 'weekly']);

export const EmailDigestPreference = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  appUserId: z.string().uuid(),
  frequency: EmailDigestFrequency.default('daily'),
  enabled: z.boolean().default(true),
  includeNotifications: z.boolean().default(true),
  includeTasks: z.boolean().default(true),
  includeApprovals: z.boolean().default(true),
  includeReports: z.boolean().default(true),
  lastSentAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpsertEmailDigestPreferenceRequest = z.object({
  frequency: EmailDigestFrequency.default('daily'),
  enabled: z.boolean().default(true),
  includeNotifications: z.boolean().default(true),
  includeTasks: z.boolean().default(true),
  includeApprovals: z.boolean().default(true),
  includeReports: z.boolean().default(true),
});

export const EmailDigestContent = z.object({
  notifications: z.array(
    z.object({ title: z.string(), body: z.string(), createdAt: z.string().datetime() })
  ),
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      status: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
  approvals: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
      risk: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
  reports: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      kind: z.string(),
      status: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
});

export const SendDigestResult = z.object({
  sent: z.boolean(),
  recipient: z.string().email().optional(),
  error: z.string().optional(),
});

export type EmailDigestPreference = z.infer<typeof EmailDigestPreference>;
export type UpsertEmailDigestPreferenceRequest = z.infer<typeof UpsertEmailDigestPreferenceRequest>;
export type EmailDigestContent = z.infer<typeof EmailDigestContent>;
export type SendDigestResult = z.infer<typeof SendDigestResult>;
