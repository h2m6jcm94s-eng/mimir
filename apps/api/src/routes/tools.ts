import { CreateToolRequest, RunToolRequest, UpdateToolRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createTool, deleteTool, getToolById, listTools, updateTool } from '../repositories/tool';
import { connectorRegistry } from '../services/connectors/registry';
import { ToolEngineError, runTool } from '../services/tools/engine';

type ToolRow = typeof schema.tool.$inferSelect;

function serializeTool(row: ToolRow) {
  return {
    ...row,
    fields:
      (row.fields as { name: string; label: string; type: string; required?: boolean }[]) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function toolsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.TOOLS_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const tools = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listTools(ctx);
    });

    return reply.send({ data: tools.map(serializeTool) });
  });

  app.get('/actions', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    return reply.send({ data: connectorRegistry.knownActions() });
  });

  app.get(
    '/:id',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const tool = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getToolById(ctx, request.params.id);
      });

      if (!tool) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Tool not found' } });
      }

      return reply.send({ data: serializeTool(tool) });
    }
  );

  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.TOOLS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateToolRequest.parse(request.body);

      const tool = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createTool(ctx, body);
      });

      return reply.status(201).send({ data: serializeTool(tool) });
    }
  );

  app.patch(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.TOOLS_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = UpdateToolRequest.parse(request.body);

      const tool = await withTenantTransaction(user.tenantId, async (ctx) => {
        return updateTool(ctx, request.params.id, body);
      });

      if (!tool) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Tool not found' } });
      }

      return reply.send({ data: serializeTool(tool) });
    }
  );

  app.delete(
    '/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.TOOLS_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return deleteTool(ctx, request.params.id);
      });

      if (!deleted) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Tool not found' } });
      }

      return reply.status(204).send();
    }
  );

  app.post(
    '/:id/run',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = RunToolRequest.parse(request.body);

      try {
        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          const tool = await getToolById(ctx, request.params.id);
          if (!tool) {
            throw new ToolEngineError('Tool not found');
          }
          return runTool(ctx, serializeTool(tool), body.input, user.userId);
        });

        return reply.send({ data: { result } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed';
        const statusCode = message === 'Tool not found' ? 404 : 400;
        return reply.status(statusCode).send({
          error: { code: 'TOOL_EXECUTION_FAILED', message },
        });
      }
    }
  );
}
