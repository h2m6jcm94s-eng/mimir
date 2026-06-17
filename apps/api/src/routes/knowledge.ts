import { SearchKnowledgeWithSharesQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { searchKnowledge } from '../repositories/knowledge';
import { searchKnowledgeWithShares } from '../repositories/knowledge-share';
import { ingestDocument } from '../services/knowledge/ingest';

const ingestSchema = z.object({
  kind: z.enum(['doc', 'code', 'screenshot', 'web']),
  uri: z.string().optional(),
  content: z.string().min(1),
  tier: z.number().int().min(0).max(2).optional(),
  meta: z.record(z.unknown()).optional(),
});

const searchSchema = SearchKnowledgeWithSharesQuery;

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
        return ingestDocument(ctx, {
          kind: body.kind,
          uri: body.uri,
          content: body.content,
          tier: body.tier,
          meta: body.meta,
        });
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
}
