import type { TenantContext } from '../../db/tenant-context';
import * as memoryRepo from '../../repositories/memory';

export async function createCheckpoint(
  ctx: TenantContext,
  input: memoryRepo.CreateMemoryCheckpointInput
) {
  return memoryRepo.createMemoryCheckpoint(ctx, input);
}

export async function listCheckpoints(ctx: TenantContext, input: { limit: number }) {
  return memoryRepo.listMemoryCheckpoints(ctx, input);
}

export async function getCheckpoint(ctx: TenantContext, id: string) {
  return memoryRepo.getMemoryCheckpointById(ctx, id);
}

export async function diffCheckpoints(ctx: TenantContext, leftId: string, rightId: string) {
  return memoryRepo.diffMemoryCheckpoints(ctx, leftId, rightId);
}

export async function restoreCheckpoint(
  ctx: TenantContext,
  checkpointId: string,
  createdBy?: string
) {
  return memoryRepo.restoreMemoryCheckpoint(ctx, checkpointId, createdBy);
}

export async function branchCheckpoint(
  ctx: TenantContext,
  input: { fromCheckpointId: string; label: string; createdBy?: string }
) {
  return memoryRepo.branchMemoryCheckpoint(ctx, input);
}
