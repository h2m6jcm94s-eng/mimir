import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { listBriefings } from '../repositories/briefing';
import { generateBriefings } from '../services/briefings/generator';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function briefingRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = listQuerySchema.parse(request.query);
      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listBriefings(ctx, query.limit);
      });

      return reply.send({ data });
    }
  );

  app.post(
    '/generate',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return generateBriefings(ctx);
      });

      return reply.status(201).send(result);
    }
  );
}
