import { CreateNotificationRequest, ListNotificationsQuery } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  getNotification,
  listNotifications,
  markNotificationRead,
} from '../repositories/notification';
import { notify } from '../services/notifications/delivery';

export async function notificationRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = ListNotificationsQuery.parse(request.query);
      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listNotifications(ctx, query.limit);
      });

      return reply.send({ data });
    }
  );

  app.get(
    '/unread-count',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const count = await withTenantTransaction(user.tenantId, async (ctx) => {
        const notifications = await listNotifications(ctx, 1000);
        return notifications.filter((n) => n.readAt === null).length;
      });

      return reply.send({ count });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateNotificationRequest.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return notify(ctx, body);
      });

      return reply.status(201).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    '/:id/read',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_WRITE) },
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
