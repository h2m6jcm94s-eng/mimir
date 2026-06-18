import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createDevice, rotateApiKey } from '../repositories/device';
import { getNode, listNodes, updateNodeHeartbeat } from '../repositories/node';

const enrollNodeSchema = z.object({
  kind: z.enum(['brain', 'desktop', 'cloud', 'phone']),
  name: z.string().min(1),
  tier: z.number().int().min(0).max(2),
  tailnetAddr: z.string().optional(),
});

export async function nodeRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const nodes = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listNodes(ctx);
      });

      return reply.send({ data: nodes });
    }
  );

  app.post(
    '/enroll',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = enrollNodeSchema.parse(request.body);
      const device = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createDevice(ctx, {
          tenantId: user.tenantId,
          ownerUserAccountId: user.userAccountId,
          kind: body.kind,
          name: body.name,
          tier: body.tier,
          tailnetAddr: body.tailnetAddr,
        });
      });

      return reply.status(201).send(device);
    }
  );

  app.get<{ Params: { nodeId: string } }>(
    '/:nodeId',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const found = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getNode(ctx, request.params.nodeId);
      });

      if (!found) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send(found);
    }
  );

  const heartbeatSchema = z.object({
    status: z.enum(['up', 'degraded', 'down']).optional(),
  });

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/heartbeat',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { nodeId } = request.params;
      const body = heartbeatSchema.parse(request.body);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const node = await getNode(ctx, nodeId);
        if (!node) return { notFound: true };
        const updated = await updateNodeHeartbeat(ctx, nodeId, body.status);
        return { updated };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send(result.updated);
    }
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/rotate-key',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { nodeId } = request.params;
      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const node = await getNode(ctx, nodeId);
        if (!node) return { notFound: true };
        const { apiKey } = await rotateApiKey(ctx, nodeId);
        return { apiKey };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send({ data: { apiKey: result.apiKey } });
    }
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/ping',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.NODES_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { nodeId } = request.params;
      const node = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getNode(ctx, nodeId);
      });

      if (!node) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send({ data: { nodeId, status: node.status, lastSeen: node.lastSeen } });
    }
  );
}
