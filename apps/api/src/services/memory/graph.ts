import type { TenantContext } from '../../db/tenant-context';
import * as memoryRepo from '../../repositories/memory';

export async function getGraph(ctx: TenantContext, input: { limit: number }) {
  return memoryRepo.getMemoryGraph(ctx, input);
}

export async function createNode(ctx: TenantContext, input: memoryRepo.CreateMemoryNodeInput) {
  return memoryRepo.createMemoryNode(ctx, input);
}

export async function updateNode(
  ctx: TenantContext,
  id: string,
  input: memoryRepo.UpdateMemoryNodeInput
) {
  return memoryRepo.updateMemoryNode(ctx, id, input);
}

export async function createEdge(ctx: TenantContext, input: memoryRepo.CreateMemoryEdgeInput) {
  return memoryRepo.createMemoryEdge(ctx, input);
}

export async function deleteEdge(ctx: TenantContext, id: string) {
  return memoryRepo.deleteMemoryEdge(ctx, id);
}

export async function getNodesByKind(
  ctx: TenantContext,
  kind: memoryRepo.CreateMemoryNodeInput['kind'],
  limit: number
) {
  return memoryRepo.listActiveMemoryNodesByKind(ctx, { kind, limit });
}
