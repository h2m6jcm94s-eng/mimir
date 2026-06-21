import type { WorkflowGraph, WorkflowNode } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import {
  getRoutineById,
  updateRoutineRun,
  updateRoutineRunStatus,
} from '../../repositories/routine';
import { connectorRegistry } from '../connectors/registry';

function topoSort(graph: WorkflowGraph): WorkflowNode[] {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: WorkflowNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const outgoing = graph.edges.filter((e) => e.source === id).map((e) => e.target);
    for (const target of outgoing) {
      visit(target);
    }
    const node = nodesById.get(id);
    if (node) result.unshift(node);
  }

  for (const node of graph.nodes) {
    visit(node.id);
  }
  return result;
}

export async function executeWorkflowGraph(
  ctx: TenantContext,
  input: {
    tenantId: string;
    userId: string;
    routineId: string;
    runId: string;
  }
): Promise<void> {
  const routine = await getRoutineById(ctx, input.routineId);
  if (!routine) {
    await updateRoutineRunStatus(ctx, input.runId, 'failed', {
      code: 'ROUTINE_NOT_FOUND',
      message: `Routine ${input.routineId} not found`,
    });
    return;
  }

  if (!routine.enabled) {
    await updateRoutineRunStatus(ctx, input.runId, 'failed', {
      code: 'ROUTINE_DISABLED',
      message: `Routine ${input.routineId} is disabled`,
    });
    return;
  }

  await updateRoutineRunStatus(ctx, input.runId, 'running');

  const graph = (routine.workflowJson ?? { nodes: [], edges: [] }) as WorkflowGraph;
  const sorted = topoSort(graph);
  const nodeOutputs: Record<string, Record<string, unknown>> = {};
  const nodeStatuses: Record<string, { status: 'ok' | 'failed'; error?: string }> = {};

  try {
    for (const node of sorted) {
      if (node.kind === 'trigger') {
        nodeOutputs[node.id] = { triggeredAt: new Date().toISOString() };
        nodeStatuses[node.id] = { status: 'ok' };
        continue;
      }

      if (node.kind === 'action') {
        const action = node.config.action as string;
        const [kind, actionName] = action.split('.');
        if (!kind || !actionName) {
          nodeStatuses[node.id] = { status: 'failed', error: `Invalid action: ${action}` };
          continue;
        }

        const actionInput = (node.config.input as Record<string, unknown>) ?? {};
        const requestTier = Number(node.config.tier ?? routine.tier ?? 0);
        try {
          const { result } = await connectorRegistry.runAction(ctx, {
            tenantId: input.tenantId,
            kind,
            action: actionName,
            input: actionInput,
            requestTier,
            actor: input.userId,
          });
          nodeOutputs[node.id] = result ?? {};
          nodeStatuses[node.id] = { status: 'ok' };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          nodeStatuses[node.id] = { status: 'failed', error: message };
        }
        continue;
      }

      if (node.kind === 'condition') {
        nodeStatuses[node.id] = { status: 'ok' };
        continue;
      }

      nodeStatuses[node.id] = { status: 'ok' };
    }

    const failed = Object.values(nodeStatuses).some((s) => s.status === 'failed');
    await updateRoutineRun(ctx, input.runId, {
      metadata: { nodeOutputs, nodeStatuses },
    });
    await updateRoutineRunStatus(
      ctx,
      input.runId,
      failed ? 'failed' : 'done',
      failed ? { code: 'NODE_FAILED', message: 'One or more workflow nodes failed' } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateRoutineRun(ctx, input.runId, {
      metadata: { nodeOutputs, nodeStatuses },
    });
    await updateRoutineRunStatus(ctx, input.runId, 'failed', {
      code: 'EXECUTION_FAILED',
      message,
    });
  }
}
