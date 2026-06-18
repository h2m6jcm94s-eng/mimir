import { TranslatePolicyRequest, UpsertPolicyRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import { getActivePolicy, upsertPolicy } from '../repositories/policy';
import { PolicyEngine } from '../services/governance/engine';
import { translatePolicy } from '../services/governance/translator';
import { ModelRouter } from '../services/models/router';

export async function governanceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.GOVERNANCE_READ));

  app.get('/policy', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const policy = await withTenantTransaction(user.tenantId, async (ctx) => {
      return getActivePolicy(ctx);
    });

    if (!policy) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'No active policy' } });
    }

    return reply.send({ data: policy });
  });

  app.put(
    '/policy',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.GOVERNANCE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = UpsertPolicyRequest.parse(request.body);

      const validation = new PolicyEngine(body.source).evaluate({
        action: 'test',
        tier: 1,
        dailySpendUsd: 0,
      });
      if (validation.effect === 'deny' && validation.reason?.startsWith('Invalid policy')) {
        return reply.status(400).send({
          error: { code: 'INVALID_POLICY', message: validation.reason },
        });
      }

      const policy = await withTenantTransaction(user.tenantId, async (ctx) => {
        const row = await upsertPolicy(ctx, {
          name: body.name,
          source: body.source,
          version: '1',
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'policy_loaded',
          tier: 0,
          payload: {
            policyId: row.id,
            name: row.name,
            version: row.version,
          },
        });

        return row;
      });

      return reply.send({ data: policy });
    }
  );

  app.post(
    '/policy/translate',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.GOVERNANCE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = TranslatePolicyRequest.parse(request.body);

      try {
        const router = new ModelRouter();
        const source = await translatePolicy(body.description, {
          invokeModel: (input) => router.invoke(1, input, { maxTokens: 1024 }),
        });
        return reply.send({ data: { source } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed';
        return reply.status(400).send({
          error: { code: 'INVALID_POLICY', message },
        });
      }
    }
  );
}
