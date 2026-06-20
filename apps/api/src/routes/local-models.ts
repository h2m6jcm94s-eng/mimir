import { PullModelRequest, UpsertLocalModelConfigRequest } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { LocalModelRuntime } from '../services/models/local-runtime';

export async function localModelRoutes(app: FastifyInstance) {
  app.get(
    '/status',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LOCAL_MODELS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const status = await withTenantTransaction(user.tenantId, async (ctx) => {
        const runtime = new LocalModelRuntime(ctx);
        return runtime.getStatus();
      });

      return reply.send({ data: status });
    }
  );

  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LOCAL_MODELS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const models = await withTenantTransaction(user.tenantId, async (ctx) => {
        const runtime = new LocalModelRuntime(ctx);
        return runtime.listModels();
      });

      return reply.send({ data: { models } });
    }
  );

  app.get(
    '/config',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LOCAL_MODELS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const config = await withTenantTransaction(user.tenantId, async (ctx) => {
        const runtime = new LocalModelRuntime(ctx);
        return runtime.getOrCreateConfig();
      });

      return reply.send({ data: config });
    }
  );

  app.put(
    '/config',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LOCAL_MODELS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = UpsertLocalModelConfigRequest.parse(request.body);

      const config = await withTenantTransaction(user.tenantId, async (ctx) => {
        const runtime = new LocalModelRuntime(ctx);
        return runtime.upsertConfig(body);
      });

      return reply.send({ data: config });
    }
  );

  app.post(
    '/pull',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.LOCAL_MODELS_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = PullModelRequest.parse(request.body);

      try {
        const result = await withTenantTransaction(user.tenantId, async (ctx) => {
          const runtime = new LocalModelRuntime(ctx);
          return runtime.pullModel(body.model);
        });

        return reply.status(202).send({ data: { jobId: result.jobId, status: 'queued' } });
      } catch (error) {
        const code =
          error instanceof Error && error.message === 'LOCAL_MODEL_DISABLED'
            ? 'LOCAL_MODEL_DISABLED'
            : 'LOCAL_MODEL_PULL_FAILED';
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(503).send({ error: { code, message } });
      }
    }
  );
}
