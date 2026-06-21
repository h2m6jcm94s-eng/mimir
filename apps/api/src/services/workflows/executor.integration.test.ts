import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createDevice } from '../../repositories/device';
import { updateNodeHeartbeat } from '../../repositories/node';
import { createRoutine, createRoutineRun, listRoutineRuns } from '../../repositories/routine';
import { executeWorkflowGraph } from './executor';

describe('executeWorkflowGraph node binding', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)(
    'fails with NODE_UNAVAILABLE when bound node is down',
    async () => {
      const externalId = `executor_node_down_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

      await withTenantTransaction(user.tenantId, async (ctx) => {
        const device = await createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: 'phone',
          name: 'Bound phone',
          tier: 0,
        });
        await updateNodeHeartbeat(ctx, device.id, 'down');

        const routine = await createRoutine(
          ctx,
          {
            name: 'Bound workflow',
            description: 'Should not run when node is down',
            jobType: 'workflow',
            jobInput: {},
            tier: 0,
            enabled: true,
            sourceFormat: 'native' as const,
            cron: '',
            nodeId: device.id,
            workflowJson: {
              nodes: [{ id: 't1', kind: 'trigger', label: 'Trigger', config: {} }],
              edges: [],
            },
          },
          user.userId
        );

        const run = await createRoutineRun(ctx, routine.id, 'pending');

        await executeWorkflowGraph(ctx, {
          tenantId: user.tenantId,
          userId: user.userId,
          routineId: routine.id,
          runId: run.id,
        });

        const runs = await listRoutineRuns(ctx, routine.id, { limit: 10 });
        const updated = runs[0];
        expect(updated?.status).toBe('failed');
        expect(updated?.errorCode).toBe('NODE_UNAVAILABLE');
        expect(updated?.metadata).toMatchObject({
          targetNodeId: device.id,
          targetNodeStatus: 'down',
        });
      });
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('records target node on successful runs', async () => {
    const externalId = `executor_node_up_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const device = await createDevice(ctx, {
        tenantId: user.tenantId,
        ownerUserAccountId: user.userAccountId,
        kind: 'desktop',
        name: 'Bound desktop',
        tier: 1,
      });

      const routine = await createRoutine(
        ctx,
        {
          name: 'Bound workflow',
          description: 'Runs when node is up',
          jobType: 'workflow',
          jobInput: {},
          tier: 1,
          enabled: true,
          sourceFormat: 'native' as const,
          cron: '',
          nodeId: device.id,
          workflowJson: {
            nodes: [{ id: 't1', kind: 'trigger', label: 'Trigger', config: {} }],
            edges: [],
          },
        },
        user.userId
      );

      const run = await createRoutineRun(ctx, routine.id, 'pending');

      await executeWorkflowGraph(ctx, {
        tenantId: user.tenantId,
        userId: user.userId,
        routineId: routine.id,
        runId: run.id,
      });

      const runs = await listRoutineRuns(ctx, routine.id, { limit: 10 });
      const updated = runs[0];
      expect(updated?.status).toBe('done');
      expect(updated?.metadata).toMatchObject({
        targetNodeId: device.id,
        targetNodeStatus: 'up',
      });
    });
  });
});
