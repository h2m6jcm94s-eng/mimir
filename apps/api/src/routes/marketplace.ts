import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { getInstalledItemIds, installItem, uninstallItem } from '../repositories/marketplace';
import { getMarketplaceCatalog, getMarketplaceItem } from '../services/marketplace';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get(
    '/items',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { items, installedIds } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const catalog = await getMarketplaceCatalog(ctx);
        const installed = await getInstalledItemIds(ctx, user.tenantId);
        return { items: catalog, installedIds: installed };
      });
      const installed = new Set(installedIds);

      return reply.send({
        data: items.map((item) => ({
          ...item,
          installed: installed.has(item.id),
        })),
      });
    }
  );

  app.post(
    '/items/:id/install',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const item = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getMarketplaceItem(ctx, params.id);
      });
      if (!item) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
      }

      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return installItem(ctx, user.tenantId, item);
      });

      return reply.status(201).send({ data: { installed: true, installId: row.id } });
    }
  );

  app.delete(
    '/installs/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETPLACE_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      await withTenantTransaction(user.tenantId, async (ctx) => {
        return uninstallItem(ctx, user.tenantId, params.id);
      });

      return reply.status(204).send();
    }
  );
}
