import { CreateReportRequest, ListReportsQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createReport, getReport, listReports, searchReports } from '../repositories/report';
import { CeoReportService } from '../services/reports/ceo';

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.REPORTS_READ));

  app.get('/ceo', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const service = new CeoReportService();
    const report = await withTenantTransaction(user.tenantId, async (ctx) => {
      return service.build(ctx);
    });

    return reply.send(report);
  });

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const query = ListReportsQuery.parse(request.query);
    const data = await withTenantTransaction(user.tenantId, async (ctx) => {
      if (query.q || query.kind) {
        return searchReports(ctx, {
          q: query.q,
          kind: query.kind,
          limit: query.limit,
        });
      }
      return listReports(ctx, query.limit);
    });

    return reply.send({ data });
  });

  app.get<{ Params: { id: string } }>(
    '/:id',
    { config: protectedRouteConfig },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const found = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getReport(ctx, request.params.id);
      });

      if (!found) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
      }

      return reply.send(found);
    }
  );

  app.post('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const body = CreateReportRequest.parse(request.body);
    const report = await withTenantTransaction(user.tenantId, async (ctx) => {
      return createReport(ctx, {
        tenantId: user.tenantId,
        ...body,
      });
    });

    return reply.status(201).send(report);
  });
}
