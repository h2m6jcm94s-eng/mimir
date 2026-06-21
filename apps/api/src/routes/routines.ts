import { CreateRoutineRequest, UpdateRoutineRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  createRoutine,
  createRoutineRun,
  deleteRoutine,
  getRoutineById,
  listRoutineRuns,
  listRoutines,
  updateRoutine,
} from '../repositories/routine';
import {
  deleteScheduledRoutine,
  scheduleRoutine,
  setRoutineSchedulePaused,
  triggerRoutine,
  updateScheduledRoutine,
} from '../services/routines/scheduler';

function toSharedRoutine(row: typeof import('../db/schema').routine.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    cron: row.cron,
    jobType: row.jobType,
    jobInput: row.jobInput as Record<string, unknown>,
    tier: row.tier as 0 | 1 | 2,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt?.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString(),
    lastRunStatus: row.lastRunStatus ?? undefined,
    nodeId: row.nodeId ?? undefined,
    createdBy: row.createdBy ?? undefined,
    policyId: row.policyId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSharedRun(row: typeof import('../db/schema').routineRun.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    routineId: row.routineId,
    jobId: row.jobId ?? undefined,
    status: row.status as 'pending' | 'running' | 'done' | 'failed',
    startedAt: row.startedAt?.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function routineRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const routines = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listRoutines(ctx);
      });

      return reply.send({ data: routines.map(toSharedRoutine) });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateRoutineRequest.parse(request.body);

      const routine = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createRoutine(ctx, body, user.userId);
      });

      try {
        await scheduleRoutine({
          tenantId: user.tenantId,
          userId: user.userId,
          routineId: routine.id,
          cron: routine.cron,
          jobType: routine.jobType,
          tier: routine.tier,
          payload: routine.jobInput as Record<string, unknown>,
          enabled: routine.enabled,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.warn(`[routines] Failed to create Temporal schedule: ${message}`);
      }

      return reply.status(201).send({ data: toSharedRoutine(routine) });
    }
  );

  app.get(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const routine = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getRoutineById(ctx, params.id);
      });

      if (!routine) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Routine not found' } });
      }

      return reply.send({ data: toSharedRoutine(routine) });
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const body = UpdateRoutineRequest.parse(request.body);

      const routine = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateRoutine(ctx, params.id, body);
      });

      if (!routine) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Routine not found' } });
      }

      try {
        if (body.enabled !== undefined && Object.keys(body).length === 1) {
          await setRoutineSchedulePaused(user.tenantId, routine.id, !routine.enabled);
        } else {
          await updateScheduledRoutine({
            tenantId: user.tenantId,
            userId: user.userId,
            routineId: routine.id,
            cron: routine.cron,
            jobType: routine.jobType,
            tier: routine.tier,
            payload: routine.jobInput as Record<string, unknown>,
            enabled: routine.enabled,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.warn(`[routines] Failed to update Temporal schedule: ${message}`);
      }

      return reply.send({ data: toSharedRoutine(routine) });
    }
  );

  app.delete(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return deleteRoutine(ctx, params.id);
      });

      if (!deleted) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Routine not found' } });
      }

      try {
        await deleteScheduledRoutine(user.tenantId, params.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.warn(`[routines] Failed to delete Temporal schedule: ${message}`);
      }

      return reply.status(204).send();
    }
  );

  app.post(
    '/:id/run',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };

      const run = await withTenantTransaction(user.tenantId, async (ctx) => {
        const routine = await getRoutineById(ctx, params.id);
        if (!routine) {
          return null;
        }
        const record = await createRoutineRun(ctx, routine.id, 'pending');
        return { routine, record };
      });

      if (!run) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Routine not found' } });
      }

      try {
        await triggerRoutine(user.tenantId, user.userId, run.routine.id, run.record.id, {
          jobType: run.routine.jobType,
          tier: run.routine.tier,
          jobInput: run.routine.jobInput as Record<string, unknown>,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await withTenantTransaction(user.tenantId, async (ctx) => {
          const { updateRoutineRunStatus } = await import('../repositories/routine.js');
          await updateRoutineRunStatus(ctx, run.record.id, 'failed', {
            code: 'TRIGGER_FAILED',
            message,
          });
        });
        return reply.status(503).send({ error: { code: 'TRIGGER_FAILED', message } });
      }

      return reply.status(202).send({ data: toSharedRun(run.record) });
    }
  );

  app.get(
    '/:id/runs',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.ROUTINES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const runs = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listRoutineRuns(ctx, params.id);
      });

      return reply.send({ data: runs.map(toSharedRun) });
    }
  );
}
