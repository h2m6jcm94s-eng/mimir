import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { metrics } from '../services/metrics/registry';

export async function metricsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.METRICS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      return reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.exposition());
    }
  );
}
