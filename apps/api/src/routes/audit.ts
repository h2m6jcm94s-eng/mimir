import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { listAuditEvents, verifyChain } from '../repositories/audit';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.AUDIT_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const query = auditQuerySchema.parse(request.query);
    const cursor = query.cursor
      ? (JSON.parse(Buffer.from(query.cursor, 'base64').toString()) as { ts: string; id: string })
      : undefined;

    const { data, nextCursor } = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listAuditEvents(ctx, { limit: query.limit, cursor });
    });

    return reply.send({
      data,
      nextCursor: nextCursor
        ? Buffer.from(JSON.stringify(nextCursor)).toString('base64')
        : undefined,
      verified: verifyChain([...data].sort((a, b) => a.ts.getTime() - b.ts.getTime())),
    });
  });
}
