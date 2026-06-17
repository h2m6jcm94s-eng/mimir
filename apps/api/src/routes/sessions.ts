import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import {
  createMessage,
  createSession,
  listMessages,
  listSessions,
  searchMessages,
} from '../repositories/session';
import { ClassificationGateway } from '../services/classification/gateway';

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

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
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
      const classifier = new ClassificationGateway();

      const message = await withTenantTransaction(user.tenantId, async (ctx) => {
        const classification =
          body.tier === undefined
            ? classifier.classify({
                prompt: body.content,
                attachments: [],
                retrievedContext: [],
              })
            : {
                tier: body.tier as 0 | 1 | 2,
                confidence: 1,
                reason: 'Tier provided by client',
                fallback: false,
                policyVersion: 'explicit',
              };

        const message = await createMessage(ctx, {
          ...body,
          sessionId: request.params.sessionId,
          tier: classification.tier,
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'classification_decision',
          tier: classification.tier,
          payload: classification as unknown as Record<string, unknown>,
        });

        return message;
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

  app.get('/search', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const query = searchSchema.parse(request.query);
    const results = await withTenantTransaction(user.tenantId, async (ctx) => {
      return searchMessages(ctx, query.query, query.limit);
    });

    return reply.send({
      query: query.query,
      results,
    });
  });
}
