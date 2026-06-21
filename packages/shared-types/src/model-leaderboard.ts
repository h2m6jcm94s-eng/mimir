import { z } from 'zod';

export const ModelInvocationStatus = z.enum(['success', 'error']);
export type ModelInvocationStatus = z.infer<typeof ModelInvocationStatus>;

export const CreateModelInvocationRequest = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  status: ModelInvocationStatus,
  latencyMs: z.number().int().min(0).optional(),
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  errorCode: z.string().optional(),
});
export type CreateModelInvocationRequest = z.infer<typeof CreateModelInvocationRequest>;

export const ModelInvocation = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  status: ModelInvocationStatus,
  latencyMs: z.number().int().nullable(),
  promptTokens: z.number().int().nullable(),
  completionTokens: z.number().int().nullable(),
  costUsd: z.number().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ModelInvocation = z.infer<typeof ModelInvocation>;

export const ModelLeaderboardEntry = z.object({
  provider: z.string(),
  model: z.string(),
  total: z.number().int(),
  success: z.number().int(),
  error: z.number().int(),
  avgLatencyMs: z.number().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type ModelLeaderboardEntry = z.infer<typeof ModelLeaderboardEntry>;

export const ModelLeaderboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type ModelLeaderboardQuery = z.infer<typeof ModelLeaderboardQuery>;
