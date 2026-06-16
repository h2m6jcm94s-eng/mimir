import type { FastifyInstance } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { listNodes } from '../repositories/node';

export async function nodeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireScope(Scopes.NODES_READ) }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const nodes = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listNodes(ctx);
    });

    return reply.send({ data: nodes });
  });
}
