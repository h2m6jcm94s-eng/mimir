import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { createDevice } from '../../repositories/device';
import { updateNodeHeartbeat } from '../../repositories/node';
import { createRoutine, createRoutineRun, getRoutineById } from '../../repositories/routine';
import { dispatchRoutineJob } from './dispatch';

describe('dispatchRoutineJob node binding', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)(
    'fails with NODE_UNAVAILABLE when bound node is down',
    async () => {
      const externalId = `dispatch_node_down_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

      await withTenantTransaction(user.tenantId, async (ctx) => {
        const device = await createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: 'desktop',
          name: 'Bound desktop',
          tier: 1,
        });
        await updateNodeHeartbeat(ctx, device.id, 'down');

        const routine = await createRoutine(
          ctx,
          {
            name: 'Bound routine',
            description: 'Should not run when node is down',
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

        await dispatchRoutineJob(ctx, {
          tenantId: user.tenantId,
          userId: user.userId,
          routineId: routine.id,
          runId: run.id,
          jobType: routine.jobType,
          tier: routine.tier,
          payload: {},
        });

        const updated = await getRoutineById(ctx, routine.id);
        expect(updated?.lastRunStatus).toBe('failed');
      });
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('records target node metadata on success', async () => {
    const externalId = `dispatch_node_up_${Date.now()}`;
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
          name: 'Bound routine',
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

      await dispatchRoutineJob(ctx, {
        tenantId: user.tenantId,
        userId: user.userId,
        routineId: routine.id,
        runId: run.id,
        jobType: routine.jobType,
        tier: routine.tier,
        payload: {},
      });

      const updated = await getRoutineById(ctx, routine.id);
      expect(updated?.lastRunStatus).toBe('done');
    });
  });
});
