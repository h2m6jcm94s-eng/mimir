import { UpsertEmailDigestPreferenceRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  getOrCreateEmailDigestPreference,
  sendEmailDigest,
  updateEmailDigestPreference,
} from '../services/email-digest/digest';

export async function emailDigestRoutes(app: FastifyInstance) {
  app.get(
    '/me',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const preference = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getOrCreateEmailDigestPreference(ctx, user.userId);
      });

      return reply.send({ data: preference });
    }
  );

  app.put(
    '/me',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = UpsertEmailDigestPreferenceRequest.parse(request.body);
      const preference = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateEmailDigestPreference(ctx, user.userId, {
          appUserId: user.userId,
          frequency: body.frequency,
          enabled: body.enabled,
          includeNotifications: body.includeNotifications,
          includeTasks: body.includeTasks,
          includeApprovals: body.includeApprovals,
          includeReports: body.includeReports,
        });
      });

      return reply.send({ data: preference });
    }
  );

  app.post(
    '/me/send-now',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NOTIFICATIONS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const preference = await getOrCreateEmailDigestPreference(ctx, user.userId);
        return sendEmailDigest(ctx, user.userId, preference);
      });

      return reply.send({ data: result });
    }
  );
}
