import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';

const WHITELIST_PREFIXES = ['/v1/health', '/v1/billing/convert', '/v1/demo/status'];

export function isDemoLockoutWhitelisted(url: string): boolean {
  return WHITELIST_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export async function demoLockoutMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.url.startsWith('/v1/')) {
    return;
  }
  if (isDemoLockoutWhitelisted(request.url)) {
    return;
  }

  const user = request.user;
  if (!user) {
    return;
  }

  const tenant = await withTenantTransaction(user.tenantId, async (ctx) => {
    return ctx.tenantScopedDb.query.tenant.findFirst({
      where: eq(schema.tenant.id, user.tenantId),
      columns: {
        id: true,
        demoExpiresAt: true,
        isDemoLocked: true,
      },
    });
  });

  if (!tenant) {
    return;
  }

  if (tenant.isDemoLocked) {
    return reply.status(403).send({
      error: {
        code: 'DEMO_EXPIRED',
        message: 'This demo workspace has been locked. Contact the admin to extend access.',
      },
    });
  }

  if (tenant.demoExpiresAt && new Date(tenant.demoExpiresAt) <= new Date()) {
    return reply.status(403).send({
      error: {
        code: 'DEMO_EXPIRED',
        message: 'This demo workspace has expired. Contact the admin to extend access.',
      },
    });
  }
}
