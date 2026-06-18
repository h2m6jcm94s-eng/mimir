import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { analyzeCode, createSandboxRunner } from '../services/sandbox';

const runSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  timeoutMs: z.number().int().min(100).max(300_000).optional(),
  env: z.record(z.string()).optional(),
  workingDir: z.string().optional(),
});

const analyzeSchema = z.object({
  code: z.string(),
});

const gateSchema = z.object({
  code: z.string(),
  run: runSchema,
});

export async function sandboxRoutes(app: FastifyInstance) {
  const runner = await createSandboxRunner();

  app.get(
    '/config',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SANDBOX_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      return reply.send({
        mode: runner.kind,
        gvisor: runner.kind === 'gvisor',
        passthrough: runner.kind === 'passthrough',
      });
    }
  );

  app.post(
    '/run',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SANDBOX_RUN) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = runSchema.parse(request.body);
      const result = await withTenantTransaction(user.tenantId, async () => {
        return runner.run(body);
      });

      return reply.send(result);
    }
  );

  app.post(
    '/analyze',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SANDBOX_ANALYZE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = analyzeSchema.parse(request.body);
      const result = analyzeCode(body.code);

      return reply.send(result);
    }
  );

  app.post(
    '/gate',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SANDBOX_RUN) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = gateSchema.parse(request.body);
      const analysis = analyzeCode(body.code);
      if (!analysis.ok) {
        return reply.status(400).send({
          error: {
            code: 'STATIC_ANALYSIS_FAILED',
            message: 'Code failed the static-analysis security gate',
            analysis,
          },
        });
      }

      const run = await withTenantTransaction(user.tenantId, async () => {
        return runner.run(body.run);
      });

      return reply.send({ allowed: true, analysis, run });
    }
  );
}
