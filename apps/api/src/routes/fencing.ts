import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  acquirePromotionLease,
  bumpEpoch,
  completePromotion,
  demoteLeader,
  getEpoch,
} from '../services/fencing/fencing';

const bumpEpochSchema = z.object({
  leaderNodeId: z.string().uuid().optional(),
});

const promoteSchema = z.object({
  candidateNodeId: z.string().uuid(),
  leaseTtlSeconds: z.coerce.number().int().min(5).max(300).optional(),
});

const demoteSchema = z.object({
  nodeId: z.string().uuid(),
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
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const current = await getEpoch(ctx);
        return bumpEpoch(ctx, current, body.leaderNodeId);
      });

      if (result === null) {
        return reply.status(409).send({ error: { code: 'STALE_EPOCH', message: 'Epoch changed' } });
      }

      return reply.send({ epoch: result });
    }
  );

  app.post(
    '/promote',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = promoteSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const { leaseToken, currentEpoch } = await acquirePromotionLease(
          ctx,
          body.candidateNodeId,
          body.leaseTtlSeconds
        );
        const epoch = await completePromotion(ctx, body.candidateNodeId, leaseToken);
        return { epoch, previousEpoch: currentEpoch };
      });

      return reply.send(result);
    }
  );

  app.post(
    '/demote',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = demoteSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return demoteLeader(ctx, body.nodeId);
      });

      return reply.send(result);
    }
  );
}
