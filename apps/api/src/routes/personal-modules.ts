import {
  CreatePersonalModuleRequest,
  ListPersonalModulesQuery,
  UpdatePersonalModuleRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  createPersonalModule,
  deletePersonalModule,
  listPersonalModules,
  markPersonalModuleDone,
  updatePersonalModule,
} from '../services/personal-modules/service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function toShared(
  row: {
    id: string;
    tenantId: string;
    kind: string;
    title: string;
    description: string | null;
    status: string;
    dueAt: Date | null;
    payload: unknown;
    createdAt: Date;
  } & Record<string, unknown>
) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.dueAt?.toISOString() ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export async function personalModuleRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreatePersonalModuleRequest.parse(request.body);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createPersonalModule(ctx, body);
      });

      return reply.status(201).send(toShared(row));
    }
  );

  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ListPersonalModulesQuery.parse(request.query);
      const rows = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listPersonalModules(ctx, {
          kind: query.kind,
          status: query.status,
          limit: query.limit,
        });
      });

      return reply.send({ data: rows.map(toShared) });
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = UpdatePersonalModuleRequest.parse(request.body);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updatePersonalModule(ctx, params.id, body);
      });

      return reply.send(toShared(row));
    }
  );

  app.delete(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      await withTenantTransaction(user.tenantId, async (ctx) => {
        return deletePersonalModule(ctx, params.id);
      });

      return reply.status(204).send();
    }
  );

  app.post(
    '/:id/done',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return markPersonalModuleDone(ctx, params.id);
      });

      return reply.send(toShared(row));
    }
  );
}
