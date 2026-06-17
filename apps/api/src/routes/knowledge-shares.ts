import {
  CreateKnowledgeShareRequest,
  KnowledgeShareActionRequest,
  ListKnowledgeSharesQuery,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { getEmbeddingsByKnowledgeItemId, getKnowledgeItemById } from '../repositories/knowledge';
import {
  approveShare,
  createShare,
  createSharedKnowledgeCopy,
  deleteSharedKnowledgeCopies,
  denyShare,
  getShareById,
  listShares,
  revokeShare,
} from '../repositories/knowledge-share';

function mapShare(row: {
  id: string;
  providerTenantId: string;
  requesterTenantId: string;
  knowledgeItemId: string;
  status: string;
  scope: string;
  tier: number;
  requestedByUserAccountId: string;
  reviewedByUserAccountId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    providerTenantId: row.providerTenantId,
    requesterTenantId: row.requesterTenantId,
    knowledgeItemId: row.knowledgeItemId,
    status: row.status,
    scope: row.scope,
    tier: row.tier,
    requestedByUserAccountId: row.requestedByUserAccountId,
    reviewedByUserAccountId: row.reviewedByUserAccountId ?? undefined,
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function handleShareError(error: unknown, reply: FastifyReply) {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  const notFoundCodes = new Set(['SHARE_NOT_FOUND', 'KNOWLEDGE_ITEM_NOT_FOUND']);
  const badRequestCodes = new Set([
    'NOT_PROVIDER',
    'NOT_SHARE_PARTICIPANT',
    'SHARE_NOT_PENDING',
    'SHARE_NOT_APPROVED',
  ]);

  if (notFoundCodes.has(message)) {
    return reply.status(404).send({ error: { code: message, message } });
  }
  if (badRequestCodes.has(message)) {
    return reply.status(400).send({ error: { code: message, message } });
  }
  throw error;
}

export async function knowledgeShareRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateKnowledgeShareRequest.parse(request.body);

      try {
        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          return createShare(ctx, {
            providerTenantId: body.providerTenantId,
            knowledgeItemId: body.knowledgeItemId,
            requestedByUserAccountId: user.userAccountId,
            scope: body.scope,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          });
        });

        return reply.status(201).send(mapShare(result));
      } catch (err) {
        return handleShareError(err, reply);
      }
    }
  );

  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ListKnowledgeSharesQuery.parse(request.query);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listShares(ctx, {
          direction: query.direction,
          status: query.status,
          limit: query.limit,
        });
      });

      return reply.send({ data: result.data.map(mapShare) });
    }
  );

  app.get(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      try {
        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          const share = await getShareById(ctx, request.params.id);
          if (!share) {
            throw new Error('SHARE_NOT_FOUND');
          }
          return share;
        });

        return reply.send(mapShare(result));
      } catch (err) {
        return handleShareError(err, reply);
      }
    }
  );

  app.post(
    '/:id/approve',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = KnowledgeShareActionRequest.parse(request.body ?? {});

      try {
        const { share, item, embeddings } = await withTenantTransaction(
          user.tenantId,
          async (ctx) => {
            const approved = await approveShare(ctx, request.params.id, {
              reviewedByUserAccountId: user.userAccountId,
            });
            const knowledgeItem = await getKnowledgeItemById(ctx, approved.knowledgeItemId);
            if (!knowledgeItem) {
              throw new Error('KNOWLEDGE_ITEM_NOT_FOUND');
            }
            const itemEmbeddings = await getEmbeddingsByKnowledgeItemId(
              ctx,
              approved.knowledgeItemId
            );
            return { share: approved, item: knowledgeItem, embeddings: itemEmbeddings };
          }
        );

        await withTenantTransaction(share.requesterTenantId, async (ctx) => {
          await createSharedKnowledgeCopy(ctx, {
            share,
            item,
            embeddings,
            actorUserAccountId: user.userAccountId,
          });
        });

        return reply.send(mapShare(share));
      } catch (err) {
        return handleShareError(err, reply);
      }
    }
  );

  app.post(
    '/:id/deny',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      try {
        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          return denyShare(ctx, request.params.id, {
            reviewedByUserAccountId: user.userAccountId,
          });
        });

        return reply.send(mapShare(result));
      } catch (err) {
        return handleShareError(err, reply);
      }
    }
  );

  app.post(
    '/:id/revoke',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      try {
        const share = await withTenantTransaction(user.tenantId, async (ctx) => {
          const s = await getShareById(ctx, request.params.id);
          if (!s) {
            throw new Error('SHARE_NOT_FOUND');
          }
          return s;
        });

        await withTenantTransaction(share.requesterTenantId, async (ctx) => {
          await deleteSharedKnowledgeCopies(ctx, request.params.id);
        });

        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          return revokeShare(ctx, request.params.id, {
            reviewedByUserAccountId: user.userAccountId,
          });
        });

        return reply.send(mapShare(result));
      } catch (err) {
        return handleShareError(err, reply);
      }
    }
  );
}
