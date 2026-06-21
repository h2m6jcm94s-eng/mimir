import { z } from 'zod';

export const CreateScreenTimeEntryRequest = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  app: z.string().max(255).optional(),
  category: z.string().max(255).optional(),
  minutes: z.number().int().min(1).max(1440),
});
export type CreateScreenTimeEntryRequest = z.infer<typeof CreateScreenTimeEntryRequest>;

export const ListScreenTimeQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  app: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type ListScreenTimeQuery = z.infer<typeof ListScreenTimeQuery>;

export const ScreenTimeEntry = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app: z.string().nullable(),
  category: z.string().nullable(),
  minutes: z.number().int(),
  createdAt: z.string().datetime(),
});
export type ScreenTimeEntry = z.infer<typeof ScreenTimeEntry>;

export const ScreenTimeSummary = z.object({
  totalMinutes: z.number().int(),
  entryCount: z.number().int(),
  dailyTotals: z.record(z.number().int()),
  categoryBreakdown: z.record(z.number().int()),
});
export type ScreenTimeSummary = z.infer<typeof ScreenTimeSummary>;

export const ScreenTimeEntryListResponse = z.object({
  data: z.array(ScreenTimeEntry),
});
export type ScreenTimeEntryListResponse = z.infer<typeof ScreenTimeEntryListResponse>;
