import { z } from 'zod';

export const RoutineSourceFormat = z.enum(['native', 'n8n']);
export type RoutineSourceFormat = z.infer<typeof RoutineSourceFormat>;

export const Routine = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  cron: z.string(),
  jobType: z.string().min(1),
  jobInput: z.record(z.unknown()).default({}),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  enabled: z.boolean().default(true),
  sourceFormat: RoutineSourceFormat.default('native'),
  workflowJson: z.record(z.unknown()).optional(),
  nodeId: z.string().uuid().optional(),
  optimizedAt: z.string().datetime().optional(),
  optimizationLog: z.array(z.record(z.unknown())).optional(),
  nextRunAt: z.string().datetime().optional(),
  lastRunAt: z.string().datetime().optional(),
  lastRunStatus: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Routine = z.infer<typeof Routine>;

export const RoutineRun = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  routineId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type RoutineRun = z.infer<typeof RoutineRun>;

export const CreateRoutineRequest = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  cron: z.string().default(''),
  jobType: z.string().min(1),
  jobInput: z.record(z.unknown()).default({}),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  enabled: z.boolean().default(true),
  sourceFormat: RoutineSourceFormat.default('native'),
  workflowJson: z.record(z.unknown()).optional(),
  nodeId: z.string().uuid().optional(),
});
export type CreateRoutineRequest = z.infer<typeof CreateRoutineRequest>;

export const UpdateRoutineRequest = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  cron: z.string().min(1).optional(),
  jobType: z.string().min(1).optional(),
  jobInput: z.record(z.unknown()).optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  enabled: z.boolean().optional(),
  sourceFormat: RoutineSourceFormat.optional(),
  workflowJson: z.record(z.unknown()).optional(),
  nodeId: z.string().uuid().optional(),
  optimizationLog: z.array(z.record(z.unknown())).optional(),
});
export type UpdateRoutineRequest = z.infer<typeof UpdateRoutineRequest>;

export const RoutineListResponse = z.object({
  data: z.array(Routine),
  nextCursor: z.string().optional(),
});
export type RoutineListResponse = z.infer<typeof RoutineListResponse>;

export const RoutineRunListResponse = z.object({
  data: z.array(RoutineRun),
  nextCursor: z.string().optional(),
});
export type RoutineRunListResponse = z.infer<typeof RoutineRunListResponse>;
