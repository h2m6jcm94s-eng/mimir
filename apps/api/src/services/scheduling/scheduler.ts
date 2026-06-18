import type { TenantContext } from '../../db/tenant-context';
import * as repo from '../../repositories/scheduling';

export async function createProject(ctx: TenantContext, input: repo.CreateProjectInput) {
  return repo.createProject(ctx, input);
}

export async function listProjects(
  ctx: TenantContext,
  options: { status?: repo.ProjectStatus; limit?: number } = {}
) {
  return repo.listProjects(ctx, options);
}

export async function getProject(ctx: TenantContext, id: string) {
  return repo.getProjectById(ctx, id);
}

export async function updateProject(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateProjectInput
) {
  return repo.updateProject(ctx, id, input);
}

export async function deleteProject(ctx: TenantContext, id: string) {
  return repo.deleteProject(ctx, id);
}

export async function createResource(ctx: TenantContext, input: repo.CreateResourceInput) {
  return repo.createResource(ctx, input);
}

export async function listResources(ctx: TenantContext, limit?: number) {
  return repo.listResources(ctx, limit);
}

export async function getResource(ctx: TenantContext, id: string) {
  return repo.getResourceById(ctx, id);
}

export async function updateResource(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateResourceInput
) {
  return repo.updateResource(ctx, id, input);
}

export async function deleteResource(ctx: TenantContext, id: string) {
  return repo.deleteResource(ctx, id);
}

export async function createScheduleAssignment(
  ctx: TenantContext,
  input: repo.CreateScheduleAssignmentInput
) {
  return repo.createScheduleAssignment(ctx, input);
}

export async function listScheduleAssignments(
  ctx: TenantContext,
  options: { weekStarting?: string; projectId?: string; resourceId?: string; limit?: number } = {}
) {
  return repo.listScheduleAssignments(ctx, options);
}

export async function getScheduleAssignment(ctx: TenantContext, id: string) {
  return repo.getScheduleAssignmentById(ctx, id);
}

export async function updateScheduleAssignment(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateScheduleAssignmentInput
) {
  return repo.updateScheduleAssignment(ctx, id, input);
}

export async function deleteScheduleAssignment(ctx: TenantContext, id: string) {
  return repo.deleteScheduleAssignment(ctx, id);
}

export async function getUtilization(ctx: TenantContext, weekStarting: string) {
  return repo.getUtilization(ctx, weekStarting);
}
