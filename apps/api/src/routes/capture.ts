import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { captureNote, getRelatedNotes } from '../services/knowledge/capture';

const captureSchema = z.object({
  content: z.string().min(1),
  tier: z.number().int().min(0).max(2).optional(),
  tags: z.array(z.string()).optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function captureRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = captureSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return captureNote(ctx, body);
      });

      return reply.status(201).send(result);
    }
  );

  app.get(
    '/:id/related',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.KNOWLEDGE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getRelatedNotes(ctx, params.id);
      });

      if (!result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
      }

      return reply.send(result);
    }
  );
}
