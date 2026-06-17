import { z } from 'zod';
import { JobStatus } from './enums';

export const TaskListQuery = z.object({
  status: JobStatus.optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type TaskListQuery = z.infer<typeof TaskListQuery>;

export const TaskListResponse = z.object({
  data: z.array(z.record(z.unknown())),
  nextCursor: z.string().optional(),
});
export type TaskListResponse = z.infer<typeof TaskListResponse>;

export const TaskCountsResponse = z.object({
  counts: z.record(z.number().int().min(0)),
});
export type TaskCountsResponse = z.infer<typeof TaskCountsResponse>;

export const UpdateJobStatusRequest = z.object({
  status: JobStatus,
  reason: z.string().optional(),
});
export type UpdateJobStatusRequest = z.infer<typeof UpdateJobStatusRequest>;
