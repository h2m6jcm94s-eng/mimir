import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createDevice } from '../repositories/device';
import { listNodes } from '../repositories/node';

const enrollNodeSchema = z.object({
  kind: z.enum(['brain', 'desktop', 'cloud', 'phone']),
  name: z.string().min(1),
  tier: z.number().int().min(0).max(2),
  tailnetAddr: z.string().optional(),
});

export async function nodeRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const nodes = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listNodes(ctx);
      });

      return reply.send({ data: nodes });
    }
  );

  app.post(
    '/enroll',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = enrollNodeSchema.parse(request.body);
      const device = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: body.kind,
          name: body.name,
          tier: body.tier,
          tailnetAddr: body.tailnetAddr,
        });
      });

      return reply.status(201).send(device);
    }
  );
}
