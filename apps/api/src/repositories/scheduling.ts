import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type ProjectStatus = (typeof schema.schedulingProjectStatusEnum.enumValues)[number];

export type CreateProjectInput = {
  name: string;
  client?: string;
  deadline?: Date;
  status?: ProjectStatus;
  estimatedHours?: number;
};

export type UpdateProjectInput = {
  name?: string;
  client?: string;
  deadline?: Date | null;
  status?: ProjectStatus;
  estimatedHours?: number;
};

export async function createProject(
  ctx: TenantContext,
  input: CreateProjectInput
): Promise<typeof schema.project.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.project)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      client: input.client ?? '',
      deadline: input.deadline ?? null,
      status: (input.status ?? 'active') as ProjectStatus,
      estimatedHours: input.estimatedHours ?? null,
    })
    .returning();
  return row;
}

export async function listProjects(
  ctx: TenantContext,
  options: { status?: ProjectStatus; limit?: number } = {}
): Promise<(typeof schema.project.$inferSelect)[]> {
  const { status, limit = 100 } = options;
  return ctx.tenantScopedDb.query.project.findMany({
    where: status ? eq(schema.project.status, status as ProjectStatus) : undefined,
    limit,
    orderBy: (project, { desc }) => [desc(project.updatedAt)],
  });
}

export async function getProjectById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.project.$inferSelect | undefined> {
  return ctx.tenantScopedDb.query.project.findFirst({
    where: eq(schema.project.id, id),
  });
}

export async function updateProject(
  ctx: TenantContext,
  id: string,
  input: UpdateProjectInput
): Promise<typeof schema.project.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.project)
    .set({
      name: input.name,
      client: input.client,
      status: input.status as ProjectStatus | undefined,
      estimatedHours: input.estimatedHours,
      deadline: input.deadline === undefined ? undefined : input.deadline,
      updatedAt: new Date(),
    })
    .where(eq(schema.project.id, id))
    .returning();
  return row;
}

export async function deleteProject(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.project)
    .where(eq(schema.project.id, id))
    .returning();
  return result.length > 0;
}

export type CreateResourceInput = {
  name: string;
  role?: string;
  weeklyCapacityHours?: number;
};

export type UpdateResourceInput = Partial<CreateResourceInput>;

export async function createResource(
  ctx: TenantContext,
  input: CreateResourceInput
): Promise<typeof schema.resource.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.resource)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      role: input.role ?? '',
      weeklyCapacityHours: input.weeklyCapacityHours ?? 40,
    })
    .returning();
  return row;
}

export async function listResources(
  ctx: TenantContext,
  limit = 100
): Promise<(typeof schema.resource.$inferSelect)[]> {
  return ctx.tenantScopedDb.query.resource.findMany({
    limit,
    orderBy: (resource, { asc }) => [asc(resource.name)],
  });
}

export async function getResourceById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.resource.$inferSelect | undefined> {
  return ctx.tenantScopedDb.query.resource.findFirst({
    where: eq(schema.resource.id, id),
  });
}

export async function updateResource(
  ctx: TenantContext,
  id: string,
  input: UpdateResourceInput
): Promise<typeof schema.resource.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.resource)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.resource.id, id))
    .returning();
  return row;
}

export async function deleteResource(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.resource)
    .where(eq(schema.resource.id, id))
    .returning();
  return result.length > 0;
}

export type CreateScheduleAssignmentInput = {
  projectId: string;
  resourceId: string;
  weekStarting: string;
  allocatedHours?: number;
};

export type UpdateScheduleAssignmentInput = Partial<CreateScheduleAssignmentInput>;

export async function createScheduleAssignment(
  ctx: TenantContext,
  input: CreateScheduleAssignmentInput
): Promise<typeof schema.scheduleAssignment.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.scheduleAssignment)
    .values({
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      resourceId: input.resourceId,
      weekStarting: input.weekStarting,
      allocatedHours: input.allocatedHours ?? 0,
    })
    .returning();
  return row;
}

export async function listScheduleAssignments(
  ctx: TenantContext,
  options: { weekStarting?: string; projectId?: string; resourceId?: string; limit?: number } = {}
): Promise<(typeof schema.scheduleAssignment.$inferSelect)[]> {
  const { weekStarting, projectId, resourceId, limit = 200 } = options;
  const conditions = [eq(schema.scheduleAssignment.tenantId, ctx.tenantId)];
  if (weekStarting) conditions.push(eq(schema.scheduleAssignment.weekStarting, weekStarting));
  if (projectId) conditions.push(eq(schema.scheduleAssignment.projectId, projectId));
  if (resourceId) conditions.push(eq(schema.scheduleAssignment.resourceId, resourceId));

  return ctx.tenantScopedDb.query.scheduleAssignment.findMany({
    where: and(...conditions),
    limit,
    orderBy: (assignment, { asc }) => [asc(assignment.weekStarting)],
  });
}

export async function getScheduleAssignmentById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.scheduleAssignment.$inferSelect | undefined> {
  return ctx.tenantScopedDb.query.scheduleAssignment.findFirst({
    where: eq(schema.scheduleAssignment.id, id),
  });
}

export async function updateScheduleAssignment(
  ctx: TenantContext,
  id: string,
  input: UpdateScheduleAssignmentInput
): Promise<typeof schema.scheduleAssignment.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.scheduleAssignment)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.scheduleAssignment.id, id))
    .returning();
  return row;
}

export async function deleteScheduleAssignment(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.scheduleAssignment)
    .where(eq(schema.scheduleAssignment.id, id))
    .returning();
  return result.length > 0;
}

export interface UtilizationSummary {
  weekStarting: string;
  totalCapacityHours: number;
  allocatedHours: number;
  remainingHours: number;
  overAllocatedCount: number;
  byResource: Array<{
    resourceId: string;
    name: string;
    capacityHours: number;
    allocatedHours: number;
    remainingHours: number;
  }>;
}

export async function getUtilization(
  ctx: TenantContext,
  weekStarting: string
): Promise<UtilizationSummary> {
  const resources = await listResources(ctx);
  const assignments = await listScheduleAssignments(ctx, { weekStarting });

  const allocatedByResource = new Map<string, number>();
  for (const a of assignments) {
    allocatedByResource.set(
      a.resourceId,
      (allocatedByResource.get(a.resourceId) ?? 0) + a.allocatedHours
    );
  }

  let totalCapacityHours = 0;
  let totalAllocatedHours = 0;
  let overAllocatedCount = 0;
  const byResource = resources.map((r) => {
    const capacityHours = r.weeklyCapacityHours;
    const allocatedHours = allocatedByResource.get(r.id) ?? 0;
    const remainingHours = capacityHours - allocatedHours;
    if (allocatedHours > capacityHours) overAllocatedCount += 1;
    totalCapacityHours += capacityHours;
    totalAllocatedHours += allocatedHours;
    return {
      resourceId: r.id,
      name: r.name,
      capacityHours,
      allocatedHours,
      remainingHours,
    };
  });

  return {
    weekStarting,
    totalCapacityHours,
    allocatedHours: totalAllocatedHours,
    remainingHours: totalCapacityHours - totalAllocatedHours,
    overAllocatedCount,
    byResource,
  };
}
