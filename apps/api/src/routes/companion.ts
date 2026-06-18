import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createCheckIn, getCheckInSummary, listCheckIns } from '../services/companion/check-in';

const moodSchema = z.enum(['great', 'good', 'okay', 'low', 'rough']);

const createCheckInSchema = z.object({
  mood: moodSchema,
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const listCheckInsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

const summarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function companionRoutes(app: FastifyInstance) {
  app.post(
    '/check-ins',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.COMPANION_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = createCheckInSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createCheckIn(ctx, { userId: user.userId, ...body });
      });

      return reply.status(201).send(result);
    }
  );

  app.get(
    '/check-ins',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.COMPANION_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = listCheckInsSchema.parse(request.query);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listCheckIns(ctx, user.userId, query);
      });

      return reply.send({ data: result });
    }
  );

  app.get(
    '/check-ins/summary',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.COMPANION_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = summarySchema.parse(request.query);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getCheckInSummary(ctx, user.userId, query.days);
      });

      return reply.send(result);
    }
  );
}
