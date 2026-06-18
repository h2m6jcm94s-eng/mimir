import { CreateLifeAdminRequest, ListLifeAdminQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { completeLifeAdmin, createLifeAdmin, listLifeAdmin } from '../services/life-admin/tracker';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function lifeAdminRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LIFE_ADMIN_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateLifeAdminRequest.parse(request.body);
      const item = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createLifeAdmin(ctx, {
          title: body.title,
          description: body.description,
          dueDate: body.dueDate,
          recurrence: body.recurrence,
          category: body.category,
          tags: body.tags,
          tier: body.tier,
        });
      });

      return reply.status(201).send(item);
    }
  );

  app.get(
    '/upcoming',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LIFE_ADMIN_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ListLifeAdminQuery.parse(request.query);
      const items = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listLifeAdmin(ctx, {
          status: query.status,
          limit: query.limit,
          daysAhead: query.daysAhead,
        });
      });

      return reply.send({ data: items });
    }
  );

  app.post(
    '/:id/done',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LIFE_ADMIN_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return completeLifeAdmin(ctx, params.id);
      });

      return reply.send(result);
    }
  );
}
