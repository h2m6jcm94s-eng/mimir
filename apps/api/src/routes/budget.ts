import { UpsertBudgetRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { BudgetService } from '../services/cost/budget';

const budgetService = new BudgetService();

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.BUDGET_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const status = await withTenantTransaction(user.tenantId, async (ctx) => {
      return budgetService.getStatus(ctx, new Date());
    });

    return reply.send({ data: status });
  });

  app.get('/forecast', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const forecast = await withTenantTransaction(user.tenantId, async (ctx) => {
      return budgetService.forecast(ctx, new Date());
    });

    return reply.send({ data: forecast });
  });

  app.get('/spend', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const series = await withTenantTransaction(user.tenantId, async (ctx) => {
      const { getSpendSeries } = await import('../repositories/budget.js');
      return getSpendSeries(ctx, new Date(), 7);
    });

    return reply.send({ data: series });
  });

  app.put(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.BUDGET_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = UpsertBudgetRequest.parse(request.body);

      const budget = await withTenantTransaction(user.tenantId, async (ctx) => {
        const { upsertBudget } = await import('../repositories/budget.js');
        return upsertBudget(ctx, body);
      });

      return reply.send({ data: budget });
    }
  );
}
