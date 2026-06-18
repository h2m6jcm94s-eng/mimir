import type { FastifyInstance, FastifyRequest } from 'fastify';
import { protectedRouteConfig } from '../middleware/route-config';

export async function demoStatusRoutes(app: FastifyInstance) {
  app.get('/status', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    return reply.send({ data: { tenantId: user.tenantId } });
  });
}
