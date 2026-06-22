import { CreateRemediationRequest, type RemediationRunListResponse } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  getRemediationRunById,
  listRemediationRuns,
  updateRemediationRun,
} from '../repositories/remediation';
import { runRemediation } from '../services/remediation/runner';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function toRemediationResponse(run: typeof import('../db/schema').remediationRun.$inferSelect) {
  return {
    id: run.id,
    tenantId: run.tenantId,
    targetType: run.targetType,
    targetId: run.targetId,
    issue: run.issue,
    action: run.action,
    status: run.status,
    output: run.output as Record<string, unknown>,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function remediationRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const runs = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listRemediationRuns(ctx, { limit: 100 });
      });

      const response: RemediationRunListResponse = {
        data: runs.map((r) => toRemediationResponse(r)),
      };
      return reply.send(response);
    }
  );

  app.get(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const run = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getRemediationRunById(ctx, params.id);
      });

      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
      }

      return reply.send({ data: toRemediationResponse(run) });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateRemediationRequest.parse(request.body);
      const run = await withTenantTransaction(user.tenantId, async (ctx) => {
        return runRemediation(ctx, body);
      });

      return reply.status(201).send({ data: toRemediationResponse(run) });
    }
  );

  app.post(
    '/:id/resolve',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const run = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateRemediationRun(ctx, params.id, { status: 'resolved' });
      });

      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
      }

      return reply.send({ data: toRemediationResponse(run) });
    }
  );
}
