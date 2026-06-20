import {
  CreateDecisionOutcomeRequest,
  CreateDecisionRequest,
  CreateValueStatementRequest,
  UpdateValueStatementRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  archiveValue,
  createValue,
  getDecisionAlignment,
  getDecisionWithOutcomes,
  getDecisions,
  getValues,
  logDecision,
  recordOutcome,
  updateValue,
} from '../services/values/journal';

function toSharedValueStatement(row: typeof import('../db/schema').valueStatement.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    appUserId: row.appUserId,
    name: row.name,
    description: row.description,
    weight: row.weight,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSharedDecision(row: typeof import('../db/schema').decision.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    appUserId: row.appUserId,
    title: row.title,
    context: row.context,
    options: row.options as { label: string; description: string }[],
    chosenOption: row.chosenOption,
    valueIds: row.valueIds as string[],
    decidedAt: row.decidedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSharedOutcome(row: typeof import('../db/schema').decisionOutcome.$inferSelect) {
  return {
    id: row.id,
    decisionId: row.decisionId,
    outcome: row.outcome,
    alignmentScore: row.alignmentScore ?? undefined,
    notes: row.notes,
    recordedAt: row.recordedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function valuesRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const values = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getValues(ctx, user.userId);
      });

      return reply.send({ data: values.map(toSharedValueStatement) });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateValueStatementRequest.parse(request.body);
      const value = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createValue(ctx, user.userId, body);
      });

      return reply.status(201).send({ data: toSharedValueStatement(value) });
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const body = UpdateValueStatementRequest.parse(request.body);
      const value = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateValue(ctx, params.id, body);
      });

      return reply.send({ data: toSharedValueStatement(value) });
    }
  );

  app.delete(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      await withTenantTransaction(user.tenantId, async (ctx) => {
        return archiveValue(ctx, params.id);
      });

      return reply.status(204).send();
    }
  );

  app.get(
    '/decisions',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const decisions = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getDecisions(ctx, user.userId);
      });

      return reply.send({ data: decisions.map(toSharedDecision) });
    }
  );

  app.post(
    '/decisions',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateDecisionRequest.parse(request.body);
      const decision = await withTenantTransaction(user.tenantId, async (ctx) => {
        return logDecision(ctx, user.userId, {
          ...body,
          decidedAt: body.decidedAt ? new Date(body.decidedAt) : undefined,
        });
      });

      return reply.status(201).send({ data: toSharedDecision(decision) });
    }
  );

  app.get(
    '/decisions/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getDecisionWithOutcomes(ctx, params.id);
      });

      if (!result) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Decision not found' } });
      }

      return reply.send({
        data: {
          decision: toSharedDecision(result.decision),
          outcomes: result.outcomes.map(toSharedOutcome),
        },
      });
    }
  );

  app.post(
    '/decisions/:id/outcome',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const body = CreateDecisionOutcomeRequest.parse(request.body);
      const outcome = await withTenantTransaction(user.tenantId, async (ctx) => {
        return recordOutcome(ctx, params.id, body);
      });

      return reply.status(201).send({ data: toSharedOutcome(outcome) });
    }
  );

  app.get(
    '/decisions/:id/alignment',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.VALUES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = request.params as { id: string };
      const alignment = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getDecisionAlignment(ctx, params.id);
      });

      return reply.send({ data: alignment });
    }
  );
}
