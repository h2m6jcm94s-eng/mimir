import {
  CreateScreenTimeEntryRequest,
  ListScreenTimeQuery,
  type ScreenTimeEntry,
  type ScreenTimeEntryListResponse,
  type ScreenTimeSummary,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  createScreenTimeEntry,
  deleteScreenTimeEntry,
  getScreenTimeSummary,
  listScreenTimeEntries,
} from '../services/screen-time/service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function toEntryResponse(row: {
  id: string;
  tenantId: string;
  date: string;
  app: string | null;
  category: string | null;
  minutes: number;
  createdAt: Date;
}): ScreenTimeEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    date: row.date,
    app: row.app ?? null,
    category: row.category ?? null,
    minutes: row.minutes,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function screenTimeRoutes(app: FastifyInstance) {
  app.post(
    '/entries',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCREEN_TIME_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateScreenTimeEntryRequest.parse(request.body);
      const row = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createScreenTimeEntry(ctx, body);
      });

      return reply.status(201).send(toEntryResponse(row));
    }
  );

  app.get(
    '/entries',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCREEN_TIME_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ListScreenTimeQuery.parse(request.query);
      const rows = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listScreenTimeEntries(ctx, {
          from: query.from,
          to: query.to,
          app: query.app,
          limit: query.limit,
        });
      });

      const response: ScreenTimeEntryListResponse = { data: rows.map(toEntryResponse) };
      return reply.send(response);
    }
  );

  app.get(
    '/summary',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCREEN_TIME_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = ListScreenTimeQuery.parse(request.query);
      const summary = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getScreenTimeSummary(ctx, {
          from: query.from,
          to: query.to,
          app: query.app,
          limit: query.limit,
        });
      });

      const response: ScreenTimeSummary = summary;
      return reply.send(response);
    }
  );

  app.delete(
    '/entries/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCREEN_TIME_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      await withTenantTransaction(user.tenantId, async (ctx) => {
        return deleteScreenTimeEntry(ctx, params.id);
      });

      return reply.status(204).send();
    }
  );
}
