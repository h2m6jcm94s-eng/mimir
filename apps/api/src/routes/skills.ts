import type {
  GenerateSkillDraftResponse,
  PublishSkillDraftResponse,
  SkillDraftListResponse,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { getSkillDraftById, listSkillDrafts, publishSkillDraft } from '../repositories/skills';
import { generateSkillDraft } from '../services/skills/builder';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createSchema = z.object({
  prompt: z.string().min(1).max(5000),
});

function toSkillDraftResponse(draft: typeof schema.skillDraft.$inferSelect) {
  return {
    id: draft.id,
    tenantId: draft.tenantId,
    name: draft.name,
    description: draft.description,
    prompt: draft.prompt,
    code: draft.code,
    payload: draft.payload as Record<string, unknown>,
    status: draft.status,
    installs: draft.installs,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export async function skillRoutes(app: FastifyInstance) {
  app.get(
    '/drafts',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const drafts = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listSkillDrafts(ctx, { limit: 100 });
      });

      const response: SkillDraftListResponse = {
        data: drafts.map((d) => toSkillDraftResponse(d)),
      };
      return reply.send(response);
    }
  );

  app.get(
    '/drafts/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const draft = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getSkillDraftById(ctx, params.id);
      });

      if (!draft) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Draft not found' } });
      }

      return reply.send(toSkillDraftResponse(draft));
    }
  );

  app.post(
    '/drafts',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = createSchema.parse(request.body);
      const draft = await withTenantTransaction(user.tenantId, async (ctx) => {
        return generateSkillDraft(ctx, body.prompt);
      });

      const response: GenerateSkillDraftResponse = {
        data: toSkillDraftResponse(draft),
      };
      return reply.status(201).send(response);
    }
  );

  app.post(
    '/drafts/:id/publish',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const draft = await withTenantTransaction(user.tenantId, async (ctx) => {
        return publishSkillDraft(ctx, params.id);
      });

      if (!draft) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Draft not found' } });
      }

      const response: PublishSkillDraftResponse = {
        data: toSkillDraftResponse(draft),
      };
      return reply.send(response);
    }
  );
}
