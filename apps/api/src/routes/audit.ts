import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TenantContext } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { listAuditEvents, verifyChain } from '../repositories/audit';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.AUDIT_READ));

  app.get('/', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const query = auditQuerySchema.parse(request.query);
    const cursor = query.cursor
      ? (JSON.parse(Buffer.from(query.cursor, 'base64').toString()) as { ts: string; id: string })
      : undefined;

    const ctx = new TenantContext(user.tenantId);
    const { data, nextCursor } = await listAuditEvents(ctx, { limit: query.limit, cursor });

    return reply.send({
      data,
      nextCursor: nextCursor
        ? Buffer.from(JSON.stringify(nextCursor)).toString('base64')
        : undefined,
      verified: verifyChain([...data].sort((a, b) => a.ts.getTime() - b.ts.getTime())),
    });
  });
}
