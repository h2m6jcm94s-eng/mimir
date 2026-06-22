import {
  type MeetingDraftResponse,
  type MeetingListResponse,
  UpdateMeetingRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  generateMeetingFollowUp,
  generateMeetingPrep,
  getMeeting,
  listMeetings,
  updateMeeting,
} from '../services/meetings/prep';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function meetingRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const meetings = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listMeetings(ctx, { status: 'active', limit: 100 });
      });

      const response: MeetingListResponse = { data: meetings };
      return reply.send(response);
    }
  );

  app.get(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const meeting = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getMeeting(ctx, params.id);
      });

      if (!meeting) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
      }

      return reply.send(meeting);
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = UpdateMeetingRequest.parse(request.body);
      const meeting = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateMeeting(ctx, params.id, body);
      });

      return reply.send(meeting);
    }
  );

  app.post(
    '/:id/prep',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return generateMeetingPrep(ctx, params.id);
      });

      const response: MeetingDraftResponse = result;
      return reply.send(response);
    }
  );

  app.post(
    '/:id/follow-up',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.PERSONAL_MODULES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return generateMeetingFollowUp(ctx, params.id);
      });

      const response: MeetingDraftResponse = result;
      return reply.send(response);
    }
  );
}
