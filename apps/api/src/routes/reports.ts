import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
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
}
