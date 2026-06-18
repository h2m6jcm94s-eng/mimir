import { z } from 'zod';

export const SchedulingProjectStatus = z.enum(['active', 'completed', 'on_hold', 'cancelled']);
export type SchedulingProjectStatus = z.infer<typeof SchedulingProjectStatus>;

export const Project = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  client: z.string(),
  deadline: z.string().datetime().nullable(),
  status: SchedulingProjectStatus,
  estimatedHours: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof Project>;

export const Resource = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  weeklyCapacityHours: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Resource = z.infer<typeof Resource>;

export const ScheduleAssignment = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  resourceId: z.string().uuid(),
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allocatedHours: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ScheduleAssignment = z.infer<typeof ScheduleAssignment>;

export const CreateProjectRequest = z.object({
  name: z.string().min(1).max(255),
  client: z.string().max(255).default(''),
  deadline: z.string().datetime().optional(),
  status: SchedulingProjectStatus.default('active'),
  estimatedHours: z.number().int().min(0).optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

export const UpdateProjectRequest = CreateProjectRequest.partial();
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequest>;

export const CreateResourceRequest = z.object({
  name: z.string().min(1).max(255),
  role: z.string().max(255).default(''),
  weeklyCapacityHours: z.number().int().min(0).max(168).default(40),
});
export type CreateResourceRequest = z.infer<typeof CreateResourceRequest>;

export const UpdateResourceRequest = CreateResourceRequest.partial();
export type UpdateResourceRequest = z.infer<typeof UpdateResourceRequest>;

export const CreateScheduleAssignmentRequest = z.object({
  projectId: z.string().uuid(),
  resourceId: z.string().uuid(),
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allocatedHours: z.number().int().min(0).max(168).default(0),
});
export type CreateScheduleAssignmentRequest = z.infer<typeof CreateScheduleAssignmentRequest>;

export const UpdateScheduleAssignmentRequest = CreateScheduleAssignmentRequest.partial();
export type UpdateScheduleAssignmentRequest = z.infer<typeof UpdateScheduleAssignmentRequest>;

export const UtilizationSummary = z.object({
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalCapacityHours: z.number().int(),
  allocatedHours: z.number().int(),
  remainingHours: z.number().int(),
  overAllocatedCount: z.number().int(),
  byResource: z.array(
    z.object({
      resourceId: z.string().uuid(),
      name: z.string(),
      capacityHours: z.number().int(),
      allocatedHours: z.number().int(),
      remainingHours: z.number().int(),
    })
  ),
});
export type UtilizationSummary = z.infer<typeof UtilizationSummary>;
