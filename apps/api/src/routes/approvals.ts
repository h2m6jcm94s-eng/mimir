import { DecideApprovalRequest } from '@mimir/shared-types';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { decideApproval, getApprovalById, listApprovals } from '../repositories/approval';
import { createAuditEvent } from '../repositories/audit';
import { updateJobStatus } from '../repositories/job';
import { verifyPin } from '../services/approvals/metadata';
import { type SandboxRunInput, analyzeCode, createSandboxRunner } from '../services/sandbox';
import { startTaskWorkflow } from '../temporal/client';
import type { TaskRunInput } from '../temporal/workflows';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const SANDBOX_JOB_TYPES = new Set(['sandbox.execute', 'sandbox.gate', 'custom_code']);

export async function approvalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.APPROVALS_READ));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const approvals = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listApprovals(ctx);
    });

    return reply.send({ data: approvals });
  });

  app.post(
    '/:id/approve',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.APPROVALS_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = DecideApprovalRequest.parse(request.body ?? {});

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

      const { approval, job } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const approval = await getApprovalById(ctx, params.id);
        if (!approval) {
          throw new Error('Approval not found');
        }
        if (approval.status !== 'pending') {
          throw new Error(`Approval already ${approval.status}`);
        }
        if (approval.expiresAt && new Date() > approval.expiresAt) {
          throw new Error('Approval request has expired');
        }

        const updated = await decideApproval(ctx, params.id, 'approved', user.userId, body.reason);
        if (!updated) {
          throw new Error('Failed to update approval');
        }

        const job = await updateJobStatus(ctx, approval.jobId, 'queued');
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'approval_decided',
          tier: job?.tier ?? 0,
          payload: {
            approvalId: updated.id,
            jobId: updated.jobId,
            decision: 'approved',
            reason: body.reason,
          },
        });

        return { approval: updated, job };
      });

      if (!job) {
        return reply
          .status(500)
          .send({ error: { code: 'INTERNAL_ERROR', message: 'Job not found' } });
      }

      if (SANDBOX_JOB_TYPES.has(job.type)) {
        const run = await executeSandboxJob(user.tenantId, user.userId, job);
        return reply.send({ data: approval, run });
      }

      const workflowInfo = await startWorkflow(user.tenantId, approval.requestedBy, job);

      return reply.send({
        data: approval,
        workflow: workflowInfo,
      });
    }
  );

  app.post(
    '/:id/deny',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.APPROVALS_WRITE) },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = DecideApprovalRequest.parse(request.body ?? {});

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

      const approval = await withTenantTransaction(user.tenantId, async (ctx) => {
        const existing = await getApprovalById(ctx, params.id);
        if (!existing) {
          throw new Error('Approval not found');
        }
        if (existing.status !== 'pending') {
          throw new Error(`Approval already ${existing.status}`);
        }
        if (existing.expiresAt && new Date() > existing.expiresAt) {
          throw new Error('Approval request has expired');
        }

        const updated = await decideApproval(ctx, params.id, 'denied', user.userId, body.reason);
        if (!updated) {
          throw new Error('Failed to update approval');
        }

        const job = await updateJobStatus(ctx, updated.jobId, 'failed');
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'approval_decided',
          tier: job?.tier ?? 0,
          payload: {
            approvalId: updated.id,
            jobId: updated.jobId,
            decision: 'denied',
            reason: body.reason,
          },
        });

        return updated;
      });

      return reply.send({ data: approval });
    }
  );
}

async function executeSandboxJob(
  tenantId: string,
  actor: string,
  job: {
    id: string;
    type: string;
    tier: number;
    input: unknown;
  }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}> {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const code = (input.code as string) ?? '';
  const run = (input.run ?? {}) as SandboxRunInput;

  const analysis = analyzeCode(code);
  if (!analysis.ok) {
    await withTenantTransaction(tenantId, async (ctx) => {
      await updateJobStatus(ctx, job.id, 'failed', {
        result: { errorCode: 'STATIC_ANALYSIS_FAILED', analysis },
      });
      await createAuditEvent(ctx, {
        actor,
        action: 'sandbox_execution_failed',
        tier: job.tier,
        payload: {
          jobId: job.id,
          command: run.command,
          staticAnalysis: analysis,
          errorCode: 'STATIC_ANALYSIS_FAILED',
        },
      });
    });
    throw new Error('Code failed the static-analysis security gate');
  }

  const runner = await createSandboxRunner();
  const result = await runner.run(run);

  await withTenantTransaction(tenantId, async (ctx) => {
    await updateJobStatus(ctx, job.id, result.exitCode === 0 ? 'done' : 'failed', {
      result: result as unknown as Record<string, unknown>,
    });
    await createAuditEvent(ctx, {
      actor,
      action: job.type === 'custom_code' ? 'custom_code_executed' : 'sandbox_executed',
      tier: job.tier,
      payload: {
        jobId: job.id,
        command: run.command,
        args: run.args,
        mode: runner.kind,
        staticAnalysis: analysis,
        exitCode: result.exitCode,
      } as unknown as Record<string, unknown>,
    });
  });

  return result;
}

async function startWorkflow(
  tenantId: string,
  userId: string,
  job: {
    id: string;
    idempotencyKey: string;
    type: string;
    tier: number;
    source: 'chat' | 'api' | 'ui' | 'routine';
    input: unknown;
  }
) {
  const input = (job.input ?? {}) as Record<string, unknown>;
  const payload = (input.payload ?? {}) as Record<string, unknown>;

  const taskRunInput: TaskRunInput = {
    tenantId,
    userId,
    jobId: job.id,
    idempotencyKey: job.idempotencyKey,
    type: job.type,
    tier: job.tier,
    source: job.source,
    payload: {
      prompt: (input.prompt as string) ?? '',
      ...payload,
    },
  };

  return startTaskWorkflow(taskRunInput);
}
