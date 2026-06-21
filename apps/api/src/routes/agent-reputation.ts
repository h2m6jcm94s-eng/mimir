import { AgentReputationFeedbackRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import type { AgentReputationRow } from '../repositories/agent-reputation';
import { applyReputationFeedback, listReputations } from '../services/agent-reputation/service';

const paramsSchema = z.object({
  role: z.string().min(1),
});

function toShared(row: AgentReputationRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    role: row.role,
    score: row.score,
    successCount: row.successCount,
    failureCount: row.failureCount,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  };
}

export async function agentReputationRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const rows = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listReputations(ctx);
      });

      return reply.send({ data: rows.map(toShared) });
    }
  );

  app.post(
    '/:role/feedback',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = AgentReputationFeedbackRequest.parse(request.body);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return applyReputationFeedback(ctx, params.role, body.outcome);
      });

      return reply.status(201).send(toShared(row));
    }
  );
}
