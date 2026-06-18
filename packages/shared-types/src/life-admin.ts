import { z } from 'zod';

export const LifeAdminRecurrence = z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']);
export type LifeAdminRecurrence = z.infer<typeof LifeAdminRecurrence>;

export const LifeAdminStatus = z.enum(['pending', 'done']);
export type LifeAdminStatus = z.infer<typeof LifeAdminStatus>;

export const CreateLifeAdminRequest = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.string().datetime(),
  recurrence: LifeAdminRecurrence.default('none'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
});
export type CreateLifeAdminRequest = z.infer<typeof CreateLifeAdminRequest>;

export const LifeAdminItem = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  dueDate: z.string().datetime(),
  recurrence: LifeAdminRecurrence,
  category: z.string().nullable().optional(),
  status: LifeAdminStatus,
  tags: z.array(z.string()).default([]),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  createdAt: z.string().datetime(),
});
export type LifeAdminItem = z.infer<typeof LifeAdminItem>;

export const ListLifeAdminQuery = z.object({
  status: LifeAdminStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  daysAhead: z.coerce.number().int().min(1).optional(),
});
export type ListLifeAdminQuery = z.infer<typeof ListLifeAdminQuery>;

export const CompleteLifeAdminResponse = z.object({
  completed: LifeAdminItem,
  next: LifeAdminItem.optional(),
});
export type CompleteLifeAdminResponse = z.infer<typeof CompleteLifeAdminResponse>;
