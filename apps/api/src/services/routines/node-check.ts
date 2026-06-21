import type { TenantContext } from '../../db/tenant-context';
import { getNode } from '../../repositories/node';

export class NodeUnavailableError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly nodeStatus: string
  ) {
    super(`Node ${nodeId} is unavailable (status: ${nodeStatus})`);
    this.name = 'NodeUnavailableError';
  }
}

export async function assertNodeAvailable(
  ctx: TenantContext,
  nodeId: string | null | undefined
): Promise<{ id: string; name: string; status: string } | undefined> {
  if (!nodeId) return undefined;

  const node = await getNode(ctx, nodeId);
  if (!node) {
    throw new NodeUnavailableError(nodeId, 'missing');
  }

  if (node.status !== 'up') {
    throw new NodeUnavailableError(node.id, node.status);
  }

  return { id: node.id, name: node.name, status: node.status };
}

export function recordTargetNode(
  metadata: Record<string, unknown> | undefined,
  node: { id: string; status: string } | undefined
): Record<string, unknown> {
  if (!node) return metadata ?? {};
  return {
    ...(metadata ?? {}),
    targetNodeId: node.id,
    targetNodeStatus: node.status,
  };
}
