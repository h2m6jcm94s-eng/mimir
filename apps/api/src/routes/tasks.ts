import { ProviderId } from '@mimir/shared-types';
import { Client, Connection } from '@temporalio/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createApproval } from '../repositories/approval';
import { createAuditEvent } from '../repositories/audit';
import {
  createJob,
  findJobByIdempotency,
  getJob,
  listJobs,
  updateJobStatus,
} from '../repositories/job';
import { ClassificationGateway } from '../services/classification/gateway';
import { BudgetExceededError, BudgetService, BudgetThrottledError } from '../services/cost/budget';
import { evaluateTenantPolicy } from '../services/governance/engine';

const attachmentSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  size: z.number().int().min(0).default(0),
});

const createTaskSchema = z.object({
  idempotencyKey: z.string().min(1),
  type: z.string().min(1),
  prompt: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  attachments: z.array(attachmentSchema).default([]),
  provider: ProviderId.optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().min(1).optional(),
  maxCostUsd: z.number().int().min(0).optional(),
});

const listTasksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const classifier = new ClassificationGateway();
const budgetService = new BudgetService();

const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue';

export async function taskRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = createTaskSchema.parse(request.body);

      const { job, classification, decision, approvalId, idempotent, budgetError } =
        await withTenantTransaction(user.tenantId, async (ctx) => {
          const existing = await findJobByIdempotency(ctx, body.idempotencyKey);
          if (existing) {
            return {
              job: existing,
              classification: null,
              decision: null,
              approvalId: null,
              idempotent: true,
              budgetError: null,
            };
          }

          const classification = classifier.classify({
            prompt: body.prompt,
            attachments: body.attachments,
            retrievedContext: [],
          });

          try {
            await budgetService.checkAction(ctx, {
              tier: classification.tier,
              projectedCostUsd: 0,
              actor: user.userId,
            });
          } catch (error) {
            if (error instanceof BudgetExceededError || error instanceof BudgetThrottledError) {
              return {
                job: null,
                classification,
                decision: null,
                approvalId: null,
                idempotent: false,
                budgetError: error,
              };
            }
            throw error;
          }

          const decision = await evaluateTenantPolicy(ctx, {
            action: body.type,
            tier: classification.tier,
          });

          await createAuditEvent(ctx, {
            actor: user.userId,
            action: 'policy_decision',
            tier: classification.tier,
            payload: {
              decision,
              action: body.type,
            } as unknown as Record<string, unknown>,
          });

          if (decision.effect === 'deny') {
            return { job: null, classification, decision, approvalId: null, idempotent: false };
          }

          const job = await createJob(ctx, {
            idempotencyKey: body.idempotencyKey,
            type: body.type,
            tier: classification.tier,
            input: { prompt: body.prompt, payload: body.payload, attachments: body.attachments },
          });

          if (decision.effect === 'require_approval') {
            const blockedJob = await updateJobStatus(ctx, job.id, 'blocked');
            const approval = await createApproval(ctx, {
              jobId: blockedJob.id,
              requestedBy: user.userId,
              reason: decision.reason,
            });
            await createAuditEvent(ctx, {
              actor: user.userId,
              action: 'approval_requested',
              tier: classification.tier,
              payload: { approvalId: approval.id, jobId: blockedJob.id },
            });
            return {
              job: blockedJob,
              classification,
              decision,
              approvalId: approval.id,
              idempotent: false,
            };
          }

          await updateJobStatus(ctx, job.id, 'queued', {
            checkpoint: { classification },
          });

          await createAuditEvent(ctx, {
            actor: user.userId,
            action: 'classification_decision',
            tier: classification.tier,
            payload: classification as unknown as Record<string, unknown>,
          });

          return { job, classification, decision, approvalId: null, idempotent: false };
        });

      if (budgetError) {
        const code =
          budgetError instanceof BudgetExceededError ? 'BUDGET_EXCEEDED' : 'BUDGET_THROTTLED';
        return reply.status(403).send({
          error: {
            code,
            message: budgetError.message,
          },
        });
      }

      if (decision?.effect === 'deny') {
        return reply.status(403).send({
          error: {
            code: 'POLICY_VIOLATION',
            message: decision.reason || 'Policy denied this action',
          },
        });
      }

      if (decision?.effect === 'require_approval' && job) {
        return reply.status(202).send({
          jobId: job.id,
          status: job.status,
          approvalId,
        });
      }

      if (idempotent) {
        if (!job) {
          return reply.status(500).send({
            error: { code: 'INTERNAL_ERROR', message: 'Job not found' },
          });
        }
        return reply.status(200).send({ jobId: job.id, status: job.status, idempotent: true });
      }

      if (!job || !classification) {
        return reply.status(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Job not created' },
        });
      }

      const connection = await Connection.connect({ address: temporalHost });
      const client = new Client({ connection });
      const workflowId = `task-${job.id}`;

      const handle = await client.workflow.start('taskRunWorkflow', {
        taskQueue,
        workflowId,
        args: [
          {
            tenantId: user.tenantId,
            userId: user.userId,
            jobId: job.id,
            idempotencyKey: body.idempotencyKey,
            type: body.type,
            tier: classification.tier,
            payload: {
              prompt: body.prompt,
              ...(body.provider && { provider: body.provider }),
              ...(body.model && { model: body.model }),
              ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
              ...(body.maxCostUsd !== undefined && { maxCostUsd: body.maxCostUsd }),
              ...body.payload,
            },
          },
        ],
      });

      return reply.status(201).send({
        jobId: job.id,
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
        status: job.status,
      });
    }
  );

  app.get(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = listTasksSchema.parse(request.query);

      const { data, nextCursor } = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listJobs(ctx, { limit: query.limit, cursor: query.cursor });
      });

      return reply.send({ data, nextCursor });
    }
  );

  app.get<{ Params: { jobId: string } }>(
    '/:jobId',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const found = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getJob(ctx, request.params.jobId);
      });
      if (!found)
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });

      return reply.send(found);
    }
  );
}
