import type { TenantContext } from '../../db/tenant-context';
import { createJob } from '../../repositories/job';
import {
  getRoutineById,
  updateRoutineRun,
  updateRoutineRunStatus,
} from '../../repositories/routine';
import { startTaskWorkflow } from '../../temporal/client';
import type { RoutineWorkflowInput } from '../../temporal/workflows';
import { executeWorkflowGraph } from '../workflows/executor';
import { NodeUnavailableError, assertNodeAvailable, recordTargetNode } from './node-check';

export async function dispatchRoutineJob(
  ctx: TenantContext,
  input: RoutineWorkflowInput
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

  if (routine.workflowJson) {
    await executeWorkflowGraph(ctx, input);
    return;
  }

  await updateRoutineRunStatus(ctx, input.runId, 'running');

  const idempotencyKey = `routine:${input.routineId}:${input.runId}:${Date.now()}`;

  try {
    const job = await createJob(ctx, {
      idempotencyKey,
      type: input.jobType,
      tier: input.tier,
      input: input.payload,
    });

    await startTaskWorkflow({
      tenantId: input.tenantId,
      userId: input.userId,
      jobId: job.id,
      idempotencyKey,
      type: input.jobType,
      tier: input.tier,
      payload: input.payload,
    });

    await updateRoutineRun(ctx, input.runId, {
      metadata: recordTargetNode(undefined, targetNode),
    });
    await updateRoutineRunStatus(ctx, input.runId, 'done');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateRoutineRun(ctx, input.runId, {
      metadata: recordTargetNode(undefined, targetNode),
    });
    await updateRoutineRunStatus(ctx, input.runId, 'failed', {
      code: 'DISPATCH_FAILED',
      message,
    });
  }
}
