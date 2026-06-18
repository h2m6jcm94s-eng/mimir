import { randomUUID } from 'node:crypto';
import { CreateSsoProviderRequest, UpdateSsoProviderRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  createScimToken,
  createSsoProvider,
  deleteSsoProvider,
  getSsoProviderById,
  listSsoProviders,
  updateSsoProvider,
} from '../repositories/sso';

type ProviderRow = typeof schema.ssoProvider.$inferSelect;
type TokenRow = typeof schema.scimToken.$inferSelect;

function serializeProvider(row: ProviderRow) {
  return {
    ...row,
    config: (row.config as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeToken(row: TokenRow, token?: string) {
  const serialized: Record<string, unknown> = {
    id: row.id,
    providerId: row.providerId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (token) {
    serialized.token = token;
  }
  return serialized;
}

export async function ssoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.SSO_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const providers = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listSsoProviders(ctx);
    });

    return reply.send({ data: providers.map(serializeProvider) });
  });

  app.get(
    '/:id',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const provider = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getSsoProviderById(ctx, request.params.id);
      });

      if (!provider) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
      }

      return reply.send({ data: serializeProvider(provider) });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SSO_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateSsoProviderRequest.parse(request.body);

      const provider = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createSsoProvider(ctx, body);
      });

      return reply.status(201).send({ data: serializeProvider(provider) });
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SSO_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = UpdateSsoProviderRequest.parse(request.body);

      const provider = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateSsoProvider(ctx, request.params.id, body);
      });

      if (!provider) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
      }

      return reply.send({ data: serializeProvider(provider) });
    }
  );

  app.delete(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SSO_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return deleteSsoProvider(ctx, request.params.id);
      });

      if (!deleted) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
      }

      return reply.status(204).send();
    }
  );

  app.post(
    '/:id/tokens',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SSO_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { name?: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const provider = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getSsoProviderById(ctx, request.params.id);
      });

      if (!provider) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
      }

      const token = `mimir_scim_${randomUUID().replace(/-/g, '')}`;
      const scimToken = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createScimToken(ctx, {
          providerId: provider.id,
          name: request.body.name ?? 'SCIM token',
          token,
        });
      });

      return reply.status(201).send({ data: serializeToken(scimToken, token) });
    }
  );
}
