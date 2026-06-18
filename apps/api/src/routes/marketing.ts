import {
  type Campaign,
  CampaignMetrics,
  CreateBrandVoiceRequest,
  CreateCampaignRequest,
  CreateContentCalendarItemRequest,
  ListCalendarQuery,
  ListCampaignsQuery,
  MarketingAnalytics,
  UpdateBrandVoiceRequest,
  UpdateCampaignRequest,
  UpdateContentCalendarItemRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import * as marketingService from '../services/marketing/assistant';

const paramsSchema = z.object({ id: z.string().uuid() });

function serializeBrandVoice(row: {
  id: string;
  tenantId: string;
  name: string;
  tone: string;
  audience: string;
  guidelines: string;
  sampleText: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    tone: row.tone,
    audience: row.audience,
    guidelines: row.guidelines,
    sampleText: row.sampleText,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCampaign(row: {
  id: string;
  tenantId: string;
  brandVoiceId: string | null;
  name: string;
  goal: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  budget: number | null;
  metrics: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Campaign {
  const metrics = CampaignMetrics.safeParse(row.metrics ?? {});
  return {
    id: row.id,
    tenantId: row.tenantId,
    brandVoiceId: row.brandVoiceId,
    name: row.name,
    goal: row.goal,
    status: row.status as Campaign['status'],
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    budget: row.budget,
    metrics: metrics.success ? metrics.data : { impressions: 0, clicks: 0, conversions: 0 },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCalendarItem(row: {
  id: string;
  tenantId: string;
  campaignId: string | null;
  title: string;
  body: string;
  platform: string;
  scheduledAt: Date | null;
  status: string;
  tier: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    campaignId: row.campaignId,
    title: row.title,
    body: row.body,
    platform: row.platform,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    status: row.status,
    tier: row.tier,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function marketingRoutes(app: FastifyInstance) {
  app.get(
    '/brand-voices',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const voices = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.listBrandVoices(ctx);
      });
      return reply.send({ data: voices.map(serializeBrandVoice) });
    }
  );

  app.post(
    '/brand-voices',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateBrandVoiceRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.createBrandVoice(ctx, body);
      });
      return reply.status(201).send({ data: serializeBrandVoice(created) });
    }
  );

  app.patch(
    '/brand-voices/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateBrandVoiceRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.updateBrandVoice(ctx, params.id, body);
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Brand voice not found' } });
      return reply.send({ data: serializeBrandVoice(updated) });
    }
  );

  app.delete(
    '/brand-voices/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.deleteBrandVoice(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Brand voice not found' } });
      return reply.status(204).send();
    }
  );

  app.get(
    '/campaigns',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = ListCampaignsQuery.parse(request.query);
      const campaigns = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.listCampaigns(ctx, { status: query.status, limit: query.limit });
      });
      return reply.send({ data: campaigns.map(serializeCampaign) });
    }
  );

  app.post(
    '/campaigns',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateCampaignRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.createCampaign(ctx, body);
      });
      return reply.status(201).send({ data: serializeCampaign(created) });
    }
  );

  app.patch(
    '/campaigns/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateCampaignRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.updateCampaign(ctx, params.id, body);
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return reply.send({ data: serializeCampaign(updated) });
    }
  );

  app.delete(
    '/campaigns/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.deleteCampaign(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return reply.status(204).send();
    }
  );

  app.get(
    '/calendar',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = ListCalendarQuery.parse(request.query);
      const items = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.listCalendarItems(ctx, {
          campaignId: query.campaignId,
          status: query.status,
          from: query.from,
          to: query.to,
          limit: query.limit,
        });
      });
      return reply.send({ data: items.map(serializeCalendarItem) });
    }
  );

  app.post(
    '/calendar',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateContentCalendarItemRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.createCalendarItem(ctx, body);
      });
      return reply.status(201).send({ data: serializeCalendarItem(created) });
    }
  );

  app.patch(
    '/calendar/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateContentCalendarItemRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.updateCalendarItem(ctx, params.id, body);
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Calendar item not found' } });
      return reply.send({ data: serializeCalendarItem(updated) });
    }
  );

  app.delete(
    '/calendar/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.deleteCalendarItem(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Calendar item not found' } });
      return reply.status(204).send();
    }
  );

  app.post(
    '/calendar/:id/generate',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = z.object({ topic: z.string().min(1).max(500) }).parse(request.body);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const item = await marketingService.getCalendarItem(ctx, params.id);
        if (!item) return null;
        const draft = await marketingService.generateDraft(ctx, {
          campaignId: item.campaignId ?? undefined,
          platform: item.platform,
          topic: body.topic,
        });
        return marketingService.updateCalendarItem(ctx, params.id, { body: draft });
      });

      if (!result)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Calendar item not found' } });
      return reply.send({ data: serializeCalendarItem(result) });
    }
  );

  app.get(
    '/analytics',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MARKETING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const analytics = await withTenantTransaction(user.tenantId, async (ctx) => {
        return marketingService.getAnalytics(ctx);
      });
      return reply.send({ data: MarketingAnalytics.parse(analytics) });
    }
  );
}
