import { SearchKnowledgeWithSharesQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import { searchKnowledge } from '../repositories/knowledge';
import { searchKnowledgeWithShares } from '../repositories/knowledge-share';
import { ingestDocument } from '../services/knowledge/ingest';
import {
  createNote,
  getGraph,
  getItem,
  linkItems,
  listItemLinks,
  listNotesService,
  removeLink,
} from '../services/knowledge/second-brain';

const ingestSchema = z.object({
  kind: z.enum(['doc', 'code', 'screenshot', 'web']),
  uri: z.string().optional(),
  content: z.string().min(1),
  tier: z.number().int().min(0).max(2).optional(),
  meta: z.record(z.unknown()).optional(),
});

const searchSchema = SearchKnowledgeWithSharesQuery;

const noteSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tier: z.number().int().min(0).max(2).optional(),
  tags: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const linkSchema = z.object({
  targetId: z.string().uuid(),
  kind: z.string().optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const linkParamsSchema = z.object({
  id: z.string().uuid(),
  linkId: z.string().uuid(),
});

export async function knowledgeRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = ingestSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const ingestResult = await ingestDocument(ctx, {
          kind: body.kind,
          uri: body.uri,
          content: body.content,
          tier: body.tier,
          meta: body.meta,
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'classification_decision',
          tier: ingestResult.tier,
          payload: ingestResult.classification as unknown as Record<string, unknown>,
        });

        return ingestResult;
      });

      return reply.status(201).send(result);
    }
  );

  app.get(
    '/search',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = searchSchema.parse(request.query);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        if (query.includeShared) {
          return searchKnowledgeWithShares(ctx, {
            query: query.q,
            limit: query.limit,
            tier: query.tier,
          });
        }
        return searchKnowledge(ctx, { query: query.q, limit: query.limit });
      });

      return reply.send(result);
    }
  );

  app.post(
    '/notes',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = noteSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createNote(ctx, body);
      });

      return reply.status(201).send(result);
    }
  );

  app.get(
    '/notes',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = listQuerySchema.parse(request.query);
      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listNotesService(ctx, { limit: query.limit });
      });

      return reply.send({ data });
    }
  );

  app.get(
    '/items/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const item = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getItem(ctx, params.id);
      });

      if (!item) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Knowledge item not found' } });
      }

      return reply.send({ item });
    }
  );

  app.post(
    '/items/:id/links',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = linkSchema.parse(request.body);
      const link = await withTenantTransaction(user.tenantId, async (ctx) => {
        return linkItems(ctx, { sourceId: params.id, targetId: body.targetId, kind: body.kind });
      });

      return reply.status(201).send({ link });
    }
  );

  app.get(
    '/items/:id/links',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const links = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listItemLinks(ctx, params.id);
      });

      return reply.send(links);
    }
  );

  app.delete(
    '/items/:id/links/:linkId',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = linkParamsSchema.parse(request.params);
      const removed = await withTenantTransaction(user.tenantId, async (ctx) => {
        return removeLink(ctx, params.linkId);
      });

      if (!removed) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Link not found' } });
      }

      return reply.status(204).send();
    }
  );

  app.get(
    '/graph',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = listQuerySchema.parse(request.query);
      const graph = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getGraph(ctx, { limit: query.limit });
      });

      return reply.send(graph);
    }
  );
}
