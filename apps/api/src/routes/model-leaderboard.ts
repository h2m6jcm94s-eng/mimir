import { CreateModelInvocationRequest, ModelLeaderboardQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { getLeaderboard, recordModelInvocation } from '../services/model-leaderboard/service';

function toSharedInvocation(row: {
  id: string;
  tenantId: string;
  provider: string;
  model: string;
  tier: number;
  status: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: string | number | null;
  errorCode: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    model: row.model,
    tier: row.tier,
    status: row.status,
    latencyMs: row.latencyMs,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    costUsd: row.costUsd === null ? null : Number(row.costUsd),
    errorCode: row.errorCode,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function modelLeaderboardRoutes(app: FastifyInstance) {
  app.post(
    '/invocations',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.METRICS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateModelInvocationRequest.parse(request.body);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return recordModelInvocation(ctx, body);
      });

      return reply.status(201).send(toSharedInvocation(row));
    }
  );

  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.METRICS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ModelLeaderboardQuery.parse(request.query);
      const rows = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getLeaderboard(ctx, query.days);
      });

      return reply.send({
        data: rows.map((r) => ({
          provider: r.provider,
          model: r.model,
          total: r.total,
          success: r.success,
          error: r.error,
          avgLatencyMs: r.avgLatencyMs,
          lastUsedAt: r.lastUsedAt ?? null,
        })),
      });
    }
  );
}
