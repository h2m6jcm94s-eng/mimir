import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createApproval } from '../repositories/approval';
import { createJob, updateJobStatus } from '../repositories/job';
import { approvalExpiresAt, buildBlastRadius } from '../services/approvals/metadata';
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

      const { job, approval } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await createJob(ctx, {
          idempotencyKey: randomUUID(),
          type: 'sandbox.gate',
          tier: 0,
          source: 'ui',
          input: { code: body.code, run: body.run, staticAnalysis: analysis },
        });
        const blockedJob = await updateJobStatus(ctx, job.id, 'blocked');
        const approval = await createApproval(ctx, {
          jobId: blockedJob.id,
          requestedBy: user.userId,
          reason: 'Sandbox gate execution requires approval',
          risk: 'high',
          blastRadius: buildBlastRadius({
            tier: 0,
            action: 'sandbox.gate',
            summary: `code snippet (${body.code.length} chars)`,
          }),
          expiresAt: approvalExpiresAt(0),
        });
        return { job: blockedJob, approval };
      });

      return reply.status(202).send({ approvalId: approval.id, jobId: job.id, analysis });
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

      const runInput = {
        command: body.command,
        args: body.args,
        timeoutMs: body.timeoutMs,
        env: body.env,
        workingDir: body.workingDir,
      };

      const { job, approval } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await createJob(ctx, {
          idempotencyKey: randomUUID(),
          type: 'sandbox.execute',
          tier: 0,
          source: 'ui',
          input: { code: body.code, run: runInput, staticAnalysis: analysis },
        });
        const blockedJob = await updateJobStatus(ctx, job.id, 'blocked');
        const approval = await createApproval(ctx, {
          jobId: blockedJob.id,
          requestedBy: user.userId,
          reason: 'Sandbox execution requires approval',
          risk: 'high',
          blastRadius: buildBlastRadius({
            tier: 0,
            action: 'sandbox.execute',
            summary: `code snippet (${body.code.length} chars)`,
          }),
          expiresAt: approvalExpiresAt(0),
        });
        return { job: blockedJob, approval };
      });

      return reply.status(202).send({ approvalId: approval.id, jobId: job.id, analysis });
    }
  );
}
