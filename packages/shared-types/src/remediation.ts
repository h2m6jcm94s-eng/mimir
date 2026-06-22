import { z } from 'zod';

export const RemediationStatus = z.enum(['pending', 'running', 'resolved', 'failed']);
export type RemediationStatus = z.infer<typeof RemediationStatus>;

export const CreateRemediationRequest = z.object({
  targetType: z.string().min(1).max(100),
  targetId: z.string().min(1).max(255),
  issue: z.string().min(1).max(2000),
});
export type CreateRemediationRequest = z.infer<typeof CreateRemediationRequest>;

export const RemediationRun = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  targetType: z.string(),
  targetId: z.string(),
  issue: z.string(),
  action: z.string().nullable(),
  status: RemediationStatus,
  output: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RemediationRun = z.infer<typeof RemediationRun>;

export const RemediationRunListResponse = z.object({
  data: z.array(RemediationRun),
});
export type RemediationRunListResponse = z.infer<typeof RemediationRunListResponse>;
