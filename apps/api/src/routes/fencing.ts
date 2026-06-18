import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { bumpEpoch, getEpoch } from '../services/fencing/fencing';

const bumpEpochSchema = z.object({
  leaderNodeId: z.string().uuid().optional(),
});

export async function fencingRoutes(app: FastifyInstance) {
  app.get(
    '/epoch',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const epoch = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getEpoch(ctx);
      });

      return reply.send({ epoch });
    }
  );

  app.post(
    '/epoch/bump',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = bumpEpochSchema.parse(request.body);
      const epoch = await withTenantTransaction(user.tenantId, async (ctx) => {
        return bumpEpoch(ctx, body.leaderNodeId);
      });

      return reply.send({ epoch });
    }
  );
}
