import {
  AgentRoleKind,
  JobEventListResponse,
  JobStatus,
  ListJobEventsQuery,
  ProviderId,
  TaskCountsResponse,
  TaskListQuery,
  UpdateJobStatusRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createApproval } from '../repositories/approval';
import { createAuditEvent } from '../repositories/audit';
import { listJobEvents } from '../repositories/event';
import {
  countJobsByStatus,
  createJob,
  findJobByIdempotency,
  getJob,
  getJobTimeline,
  listJobs,
  setJobWorkflowIds,
  updateJobStatus,
} from '../repositories/job';
import { ClassificationGateway } from '../services/classification/gateway';
import { BudgetExceededError, BudgetService, BudgetThrottledError } from '../services/cost/budget';
import { publishJobEvent } from '../services/events/publisher';
import { StaleEpochError } from '../services/fencing/fencing';
import { evaluateTenantPolicy } from '../services/governance/engine';
import { startTaskWorkflow, terminateWorkflow } from '../temporal/client';

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
  role: AgentRoleKind.optional(),
  maxTokens: z.number().int().min(1).optional(),
  maxCostUsd: z.number().int().min(0).optional(),
});

const listTasksSchema = TaskListQuery;

const timelineSchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(12),
});

const listEventsSchema = ListJobEventsQuery;

const manualTransitions: Record<string, Set<string>> = {
  queued: new Set(['blocked']),
  running: new Set(['blocked']),
  blocked: new Set(['queued']),
  needs_attention: new Set(['queued']),
  done: new Set(),
  failed: new Set(),
};

function isValidManualTransition(from: string, to: string): boolean {
  return manualTransitions[from]?.has(to) ?? false;
}

const classifier = new ClassificationGateway();
const budgetService = new BudgetService();

const cancellableStatuses = new Set<string>(['queued', 'running']);
const retriableStatuses = new Set<string>(['failed', 'needs_attention']);

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

          await publishJobEvent(ctx, {
            jobId: job.id,
            type: 'job.created',
            payload: { type: body.type, tier: classification.tier },
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
            await publishJobEvent(ctx, {
              jobId: blockedJob.id,
              type: 'job.approval.requested',
              payload: { approvalId: approval.id, reason: decision.reason },
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

          await publishJobEvent(ctx, {
            jobId: job.id,
            type: 'job.queued',
            payload: { classification },
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

      const { workflowId, runId } = await startTaskWorkflow({
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
          ...(body.role && { role: body.role }),
          ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
          ...(body.maxCostUsd !== undefined && { maxCostUsd: body.maxCostUsd }),
          ...body.payload,
        },
      });

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await setJobWorkflowIds(ctx, job.id, workflowId, runId);
      });

      return reply.status(201).send({
        jobId: job.id,
        workflowId,
        runId,
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
        return listJobs(ctx, {
          limit: query.limit,
          cursor: query.cursor,
          status: query.status,
          type: query.type,
        });
      });

      return reply.send({ data, nextCursor });
    }
  );

  app.get(
    '/counts',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const counts = await withTenantTransaction(user.tenantId, async (ctx) => {
        return countJobsByStatus(ctx);
      });

      const typed = JobStatus.options.reduce(
        (acc, status) => {
          acc[status] = counts[status] ?? 0;
          return acc;
        },
        {} as Record<(typeof JobStatus)['options'][number], number>
      );

      return reply.send(TaskCountsResponse.parse({ counts: typed }));
    }
  );

  app.patch<{ Params: { jobId: string } }>(
    '/:jobId/status',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { jobId } = request.params;
      const body = UpdateJobStatusRequest.parse(request.body);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await getJob(ctx, jobId);
        if (!job) return { notFound: true };

        if (!isValidManualTransition(job.status, body.status)) {
          return { invalidTransition: true, from: job.status };
        }

        let updated: Awaited<ReturnType<typeof updateJobStatus>>;
        try {
          updated = await updateJobStatus(
            ctx,
            jobId,
            body.status,
            {
              ...(body.reason && { errorMessage: body.reason }),
            },
            body.epoch
          );
        } catch (error) {
          if (error instanceof StaleEpochError) {
            return { staleEpoch: true };
          }
          throw error;
        }

        await publishJobEvent(ctx, {
          jobId: updated.id,
          type: 'job.status_updated',
          payload: {
            previousStatus: job.status,
            newStatus: updated.status,
            reason: body.reason ?? null,
          },
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'job_status_updated',
          tier: updated.tier,
          payload: {
            jobId: updated.id,
            previousStatus: job.status,
            newStatus: updated.status,
            reason: body.reason ?? null,
          } as unknown as Record<string, unknown>,
        });

        return { updated };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }
      if ('invalidTransition' in result) {
        return reply.status(409).send({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition job from ${result.from} to ${body.status}`,
          },
        });
      }
      if ('staleEpoch' in result) {
        return reply
          .status(409)
          .send({ error: { code: 'STALE_EPOCH', message: 'Stale epoch: write rejected' } });
      }

      return reply.send(result.updated);
    }
  );

  const cancelJobSchema = z.object({
    epoch: z.coerce.number().int().min(0).optional(),
  });

  app.post<{ Params: { jobId: string } }>(
    '/:jobId/cancel',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { jobId } = request.params;
      const cancelBody = cancelJobSchema.parse(request.body);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await getJob(ctx, jobId);
        if (!job) return { notFound: true };

        if (!cancellableStatuses.has(job.status)) {
          return { notCancellable: true, status: job.status };
        }

        if (job.workflowId) {
          await terminateWorkflow(job.workflowId);
        }

        let updated: Awaited<ReturnType<typeof updateJobStatus>>;
        try {
          updated = await updateJobStatus(
            ctx,
            jobId,
            'failed',
            {
              errorCode: 'cancelled',
              errorMessage: 'Cancelled by user',
            },
            cancelBody.epoch
          );
        } catch (error) {
          if (error instanceof StaleEpochError) {
            return { staleEpoch: true };
          }
          throw error;
        }

        await publishJobEvent(ctx, {
          jobId: updated.id,
          type: 'job.cancelled',
          payload: {
            previousStatus: job.status,
            workflowId: job.workflowId ?? null,
          },
        });

        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'job_cancelled',
          tier: updated.tier,
          payload: {
            jobId: updated.id,
            previousStatus: job.status,
            workflowId: job.workflowId ?? null,
          } as unknown as Record<string, unknown>,
        });

        return { updated };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }
      if ('notCancellable' in result) {
        return reply.status(409).send({
          error: {
            code: 'NOT_CANCELLABLE',
            message: `Job is ${result.status} and cannot be cancelled`,
          },
        });
      }
      if ('staleEpoch' in result) {
        return reply
          .status(409)
          .send({ error: { code: 'STALE_EPOCH', message: 'Stale epoch: write rejected' } });
      }

      return reply.send(result.updated);
    }
  );

  const retryJobSchema = z.object({
    epoch: z.coerce.number().int().min(0).optional(),
  });

  app.post<{ Params: { jobId: string } }>(
    '/:jobId/retry',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { jobId } = request.params;
      const retryBody = retryJobSchema.parse(request.body);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await getJob(ctx, jobId);
        if (!job) return { notFound: true };

        if (!retriableStatuses.has(job.status)) {
          return { notRetriable: true, status: job.status };
        }

        if (job.retryCount >= job.maxRetries) {
          return { retriesExhausted: true, retryCount: job.retryCount };
        }

        let updated: Awaited<ReturnType<typeof updateJobStatus>>;
        try {
          updated = await updateJobStatus(
            ctx,
            jobId,
            'queued',
            {
              retryCount: job.retryCount + 1,
              finishedAt: null,
              errorCode: null,
              errorMessage: null,
            },
            retryBody.epoch
          );
        } catch (error) {
          if (error instanceof StaleEpochError) {
            return { staleEpoch: true };
          }
          throw error;
        }

        await publishJobEvent(ctx, {
          jobId: updated.id,
          type: 'job.retried',
          payload: { retryCount: updated.retryCount },
        });

        return { updated, input: job.input };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }
      if ('notRetriable' in result) {
        return reply.status(409).send({
          error: {
            code: 'NOT_RETRIABLE',
            message: `Job is ${result.status} and cannot be retried`,
          },
        });
      }
      if ('retriesExhausted' in result) {
        return reply.status(409).send({
          error: {
            code: 'RETRIES_EXHAUSTED',
            message: `Maximum retry count (${result.retryCount}) reached`,
          },
        });
      }
      if ('staleEpoch' in result) {
        return reply
          .status(409)
          .send({ error: { code: 'STALE_EPOCH', message: 'Stale epoch: write rejected' } });
      }

      const input = result.input as Record<string, unknown> | undefined;
      const { workflowId, runId } = await startTaskWorkflow({
        tenantId: user.tenantId,
        userId: user.userId,
        jobId: result.updated.id,
        idempotencyKey: result.updated.idempotencyKey,
        type: result.updated.type,
        tier: result.updated.tier,
        payload: (input ?? {}) as Record<string, unknown>,
      });

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await setJobWorkflowIds(ctx, result.updated.id, workflowId, runId);
      });

      return reply.send({
        jobId: result.updated.id,
        workflowId,
        runId,
        status: result.updated.status,
      });
    }
  );

  app.get(
    '/timeline',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = timelineSchema.parse(request.query);
      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getJobTimeline(ctx, query.hours);
      });

      return reply.send({ data });
    }
  );

  app.get<{ Params: { jobId: string } }>(
    '/:jobId/events',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.JOBS_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const { jobId } = request.params;
      const query = listEventsSchema.parse(request.query);

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        const job = await getJob(ctx, jobId);
        if (!job) return { notFound: true };
        return listJobEvents(ctx, { jobId, limit: query.limit, cursor: query.cursor });
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      }

      return reply.send(JobEventListResponse.parse(result));
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
