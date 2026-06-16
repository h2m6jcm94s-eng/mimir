import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createMessage, createSession, listMessages, listSessions } from '../repositories/session';

const createSessionSchema = z.object({
  source: z.enum(['web', 'telegram', 'discord', 'slack', 'cli', 'api']).default('web'),
  model: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  model: z.string().optional(),
  tier: z.number().int().min(0).max(2).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function sessionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.CHAT_READ));

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = createSessionSchema.parse(request.body);
      const session = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createSession(ctx, body);
      });
      return reply.status(201).send(session);
    }
  );

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const query = paginationSchema.parse(request.query);
    const result = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listSessions(ctx, query);
    });
    return reply.send(result);
  });

  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/messages',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = createMessageSchema.parse(request.body);
      const message = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createMessage(ctx, { ...body, sessionId: request.params.sessionId });
      });
      return reply.status(201).send(message);
    }
  );

  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/messages',
    { config: protectedRouteConfig },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = paginationSchema.parse(request.query);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listMessages(ctx, request.params.sessionId, query);
      });
      return reply.send(result);
    }
  );
}
