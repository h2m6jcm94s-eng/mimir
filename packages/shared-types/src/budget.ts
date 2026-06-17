import { z } from 'zod';

export const Budget = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  dailyBudgetUsd: z.number().int().min(0),
  monthlyBudgetUsd: z.number().int().min(0),
  throttleThreshold: z.number().min(0).max(1),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Budget = z.infer<typeof Budget>;

export const UpsertBudgetRequest = z.object({
  dailyBudgetUsd: z.number().int().min(0).optional(),
  monthlyBudgetUsd: z.number().int().min(0).optional(),
  throttleThreshold: z.number().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
});
export type UpsertBudgetRequest = z.infer<typeof UpsertBudgetRequest>;

export const BudgetStatus = z.object({
  dailyBudgetUsd: z.number().int().min(0),
  monthlyBudgetUsd: z.number().int().min(0),
  dailySpendUsd: z.number().int().min(0),
  monthlySpendUsd: z.number().int().min(0),
  dailyRemainingUsd: z.number().int(),
  monthlyRemainingUsd: z.number().int(),
  throttleThreshold: z.number().min(0).max(1),
  throttled: z.boolean(),
  exceeded: z.boolean(),
  enabled: z.boolean(),
});
export type BudgetStatus = z.infer<typeof BudgetStatus>;

export const BudgetForecast = z.object({
  projectedEndOfDayUsd: z.number().int().min(0),
  projectedMonthEndUsd: z.number().int().min(0),
  daysUntilDailyBudgetDepleted: z.number().nullable(),
  daysUntilMonthlyBudgetDepleted: z.number().nullable(),
  averageHourlyBurnUsd: z.number(),
});
export type BudgetForecast = z.infer<typeof BudgetForecast>;
