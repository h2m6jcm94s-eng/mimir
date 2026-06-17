import { AgentResolutionRequest, AgentRoleInput } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { agentRoleRegistry } from '../services/agents/registry';

const idParamsSchema = z.object({
  roleId: z.string().uuid(),
});

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.JOBS_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const roles = await withTenantTransaction(user.tenantId, async (ctx) => {
      await agentRoleRegistry.seedDefaults(ctx);
      return agentRoleRegistry.list(ctx);
    });
    return reply.send({ roles });
  });

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const input = AgentRoleInput.parse(request.body);
      const role = await withTenantTransaction(user.tenantId, async (ctx) => {
        return agentRoleRegistry.create(ctx, input);
      });
      return reply.status(201).send(role);
    }
  );

  app.get<{ Params: { roleId: string } }>(
    '/:roleId',
    { config: protectedRouteConfig },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { roleId } = idParamsSchema.parse(request.params);
      const role = await withTenantTransaction(user.tenantId, async (ctx) => {
        return agentRoleRegistry.get(ctx, roleId);
      });
      if (!role) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Agent role not found' } });
      }
      return reply.send(role);
    }
  );

  app.patch<{ Params: { roleId: string } }>(
    '/:roleId',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { roleId } = idParamsSchema.parse(request.params);
      const input = AgentRoleInput.partial().parse(request.body);
      const role = await withTenantTransaction(user.tenantId, async (ctx) => {
        return agentRoleRegistry.update(ctx, roleId, input);
      });
      if (!role) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Agent role not found' } });
      }
      return reply.send(role);
    }
  );

  app.delete<{ Params: { roleId: string } }>(
    '/:roleId',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { roleId } = idParamsSchema.parse(request.params);
      const role = await withTenantTransaction(user.tenantId, async (ctx) => {
        return agentRoleRegistry.delete(ctx, roleId);
      });
      if (!role) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Agent role not found' } });
      }
      return reply.status(204).send();
    }
  );

  app.post('/resolve', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const requestPayload = AgentResolutionRequest.parse(request.body);
    const result = await withTenantTransaction(user.tenantId, async (ctx) => {
      await agentRoleRegistry.seedDefaults(ctx);
      return agentRoleRegistry.resolve(ctx, requestPayload);
    });
    return reply.send(result);
  });
}
