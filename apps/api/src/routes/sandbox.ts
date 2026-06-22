import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import { verifyPin } from '../services/approvals/metadata';
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

const executeSchema = z.object({
  code: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  timeoutMs: z.number().int().min(100).max(300_000).optional(),
  env: z.record(z.string()).optional(),
  workingDir: z.string().optional(),
  pin: z.string().min(1),
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

  app.post(
    '/execute',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SANDBOX_RUN) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = executeSchema.parse(request.body);

      const userAccount = await db.query.userAccount.findFirst({
        where: eq(schema.userAccount.id, user.userAccountId),
      });
      if (!userAccount) {
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'User account not found' },
        });
      }

      if (!verifyPin(body.pin, userAccount.pinHash)) {
        return reply.status(403).send({
          error: { code: 'INVALID_PIN', message: 'PIN is invalid or missing' },
        });
      }

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

      const run = await withTenantTransaction(user.tenantId, async (ctx) => {
        const result = await runner.run({
          command: body.command,
          args: body.args,
          timeoutMs: body.timeoutMs,
          env: body.env,
          workingDir: body.workingDir,
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'sandbox_executed',
          tier: 0,
          payload: {
            command: body.command,
            args: body.args,
            mode: runner.kind,
            staticAnalysis: analysis,
            exitCode: result.exitCode,
          } as unknown as Record<string, unknown>,
        });

        return result;
      });

      return reply.send({ allowed: true, analysis, run });
    }
  );
}
