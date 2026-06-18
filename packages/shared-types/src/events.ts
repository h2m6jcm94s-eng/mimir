import { z } from 'zod';
import { JobStatus } from './enums';

export const JobEventType = z.enum([
  'job.created',
  'job.queued',
  'job.blocked',
  'job.running',
  'job.build.completed',
  'job.review.completed',
  'job.patch.applied',
  'job.apply.completed',
  'job.apply.failed',
  'job.done',
  'job.failed',
  'job.cancelled',
  'job.retried',
  'job.status_updated',
  'job.approval.requested',
  'cloud_worker_returned',
]);
export type JobEventType = z.infer<typeof JobEventType>;

export const JobEvent = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  type: JobEventType,
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type JobEvent = z.infer<typeof JobEvent>;

export const JobEventListResponse = z.object({
  data: z.array(JobEvent),
  nextCursor: z.string().optional(),
});
export type JobEventListResponse = z.infer<typeof JobEventListResponse>;

export const ListJobEventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type ListJobEventsQuery = z.infer<typeof ListJobEventsQuery>;
