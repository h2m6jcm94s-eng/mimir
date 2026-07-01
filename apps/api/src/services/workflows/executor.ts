import { randomUUID } from 'node:crypto';
import type { WorkflowGraph, WorkflowNode } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import { createApproval } from '../../repositories/approval';
import { createJob, updateJobStatus } from '../../repositories/job';
import {
  getRoutineById,
  updateRoutineRun,
  updateRoutineRunStatus,
} from '../../repositories/routine';
import {
  approvalExpiresAt,
  buildBlastRadius,
  riskFromTier,
} from '../../services/approvals/metadata';
import { analyzeCode } from '../../services/sandbox';
import { connectorRegistry } from '../connectors/registry';
import {
  NodeUnavailableError,
  assertNodeAvailable,
  recordTargetNode,
} from '../routines/node-check';

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

  let targetNode: { id: string; status: string } | undefined;
  try {
    const node = await assertNodeAvailable(ctx, routine.nodeId);
    if (node) {
      targetNode = { id: node.id, status: node.status };
    }
  } catch (error) {
    if (error instanceof NodeUnavailableError) {
      await updateRoutineRunStatus(ctx, input.runId, 'failed', {
        code: 'NODE_UNAVAILABLE',
        message: error.message,
      });
      await updateRoutineRun(ctx, input.runId, {
        metadata: recordTargetNode(undefined, { id: error.nodeId, status: error.nodeStatus }),
      });
      return;
    }
    throw error;
  }

  await updateRoutineRunStatus(ctx, input.runId, 'running');

  const graph = (routine.workflowJson ?? { nodes: [], edges: [] }) as WorkflowGraph;
  const sorted = topoSort(graph);
  const nodeOutputs: Record<string, Record<string, unknown>> = {};
  const nodeStatuses: Record<string, { status: 'ok' | 'failed' | 'blocked'; error?: string }> = {};

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

      if (node.kind === 'custom_code') {
        const code = node.config.code as string | undefined;
        if (!code) {
          nodeStatuses[node.id] = { status: 'failed', error: 'Missing custom_code source' };
          continue;
        }

        const analysis = analyzeCode(code);
        if (!analysis.ok) {
          nodeStatuses[node.id] = {
            status: 'failed',
            error: `Static analysis failed: ${analysis.messages.map((m) => m.ruleId).join(', ')}`,
          };
          continue;
        }

        const run = (node.config.run as Record<string, unknown> | undefined) ?? {};
        const job = await createJob(ctx, {
          idempotencyKey: randomUUID(),
          type: 'custom_code',
          tier: Number(node.config.tier ?? routine.tier ?? 0),
          source: 'routine',
          input: {
            code,
            run,
            nodeId: node.id,
            routineId: input.routineId,
            routineRunId: input.runId,
            staticAnalysis: analysis,
          },
        });
        await updateJobStatus(ctx, job.id, 'blocked');
        await createApproval(ctx, {
          jobId: job.id,
          requestedBy: input.userId,
          reason: 'custom_code workflow node requires approval',
          risk: riskFromTier(job.tier),
          blastRadius: buildBlastRadius({
            tier: job.tier,
            action: 'custom_code',
            summary: `workflow node ${node.label} (${node.id})`,
          }),
          expiresAt: approvalExpiresAt(job.tier),
        });

        nodeStatuses[node.id] = { status: 'blocked' };
        continue;
      }

      nodeStatuses[node.id] = { status: 'ok' };
    }

    const failed = Object.values(nodeStatuses).some((s) => s.status === 'failed');
    await updateRoutineRun(ctx, input.runId, {
      metadata: recordTargetNode({ nodeOutputs, nodeStatuses }, targetNode),
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
      metadata: recordTargetNode({ nodeOutputs, nodeStatuses }, targetNode),
    });
    await updateRoutineRunStatus(ctx, input.runId, 'failed', {
      code: 'EXECUTION_FAILED',
      message,
    });
  }
}
