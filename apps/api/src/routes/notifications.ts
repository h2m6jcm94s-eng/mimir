import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  getNotification,
  listNotifications,
  markNotificationRead,
} from '../repositories/notification';
import { notify } from '../services/notifications/delivery';

const createNotificationSchema = z.object({
  kind: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  dedupKey: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['in_app', 'email', 'slack', 'webhook'])).default(['in_app']),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = listQuerySchema.parse(request.query);
      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listNotifications(ctx, query.limit);
      });

      return reply.send({ data });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = createNotificationSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return notify(ctx, body);
      });

      return reply.status(201).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    '/:id/read',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { id } = request.params;
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const notification = await getNotification(ctx, id);
        if (!notification) return { notFound: true };
        const updated = await markNotificationRead(ctx, id);
        return { updated };
      });

      if ('notFound' in result) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }

      return reply.send(result.updated);
    }
  );
}
