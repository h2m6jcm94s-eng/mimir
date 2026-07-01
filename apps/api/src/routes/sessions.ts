import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import {
  createChildSession,
  createMessage,
  createSession,
  getSessionRootId,
  getSessionState,
  listActiveSessions,
  listMessages,
  listSessions,
  searchMessages,
} from '../repositories/session';
import { getClassificationGateway } from '../services/classification/gateway';

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
  tokensIn: z.number().int().optional(),
  tokensOut: z.number().int().optional(),
  costUsd: z.number().int().optional(),
  sources: z.string().optional(),
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
      const classifier = getClassificationGateway();

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

        const rootId = await getSessionRootId(ctx, request.params.sessionId);
        const message = await createMessage(ctx, {
          ...body,
          sessionId: rootId,
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
        const rootId = await getSessionRootId(ctx, request.params.sessionId);
        return listMessages(ctx, rootId, query);
      });
      return reply.send(result);
    }
  );

  app.get<{ Params: { sessionId: string } }>(
    '/:sessionId/state',
    { config: protectedRouteConfig },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getSessionState(ctx, request.params.sessionId);
      });

      if (!result) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
      }

      return reply.send({
        data: {
          session: {
            id: result.session.id,
            parentId: result.session.parentId ?? undefined,
            source: result.session.source,
            model: result.session.model ?? undefined,
            createdAt: result.session.createdAt.toISOString(),
          },
          messages: result.messages.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            role: m.role,
            content: m.content,
            model: m.model ?? undefined,
            tier: m.tier,
            costUsd: m.costUsd ?? undefined,
            sources: m.sources ?? undefined,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    '/:sessionId/resume',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const parent = await getSessionState(ctx, request.params.sessionId);
        if (!parent) return null;
        return createChildSession(ctx, {
          source: 'web',
          model: parent.session.model ?? undefined,
          parentId: parent.session.id,
        });
      });

      if (!result) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
      }

      return reply.status(201).send({ data: result });
    }
  );

  app.get('/active', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const result = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listActiveSessions(ctx, { limit: 50 });
    });

    return reply.send({
      data: result.map((s) => ({
        id: s.id,
        source: s.source,
        model: s.model ?? undefined,
        lastMessageAt: s.lastMessageAt.toISOString(),
        messageCount: s.messageCount,
      })),
    });
  });

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
