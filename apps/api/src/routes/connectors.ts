import {
  ConnectorActionRequest,
  CreateConnectorRequest,
  GitHubOpenPrInput,
} from '@mimir/shared-types';
import { Client, Connection } from '@temporalio/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createApproval } from '../repositories/approval';
import { createAuditEvent } from '../repositories/audit';
import {
  createConnector,
  deleteConnector,
  findConnectorByKind,
  listConnectors,
} from '../repositories/connector';
import { createJob, findJobByIdempotency, updateJobStatus } from '../repositories/job';
import { ClassificationGateway } from '../services/classification/gateway';
import { connectorRegistry } from '../services/connectors/registry';
import { evaluateTenantPolicy } from '../services/governance/engine';

const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue';

const paramsSchema = z.object({
  kind: z.enum(['github']),
  action: z.string().min(1),
});

export async function connectorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.CONNECTORS_ADMIN));

  app.get('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const result = await withTenantTransaction(user.tenantId, async (ctx) => {
      return listConnectors(ctx);
    });
    return reply.send({ data: result });
  });

  app.post('/', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user)
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    const body = CreateConnectorRequest.parse(request.body);
    const result = await withTenantTransaction(user.tenantId, async (ctx) => {
      const existing = await findConnectorByKind(ctx, body.kind);
      if (existing) {
        throw new Error(`Connector ${body.kind} already exists for this tenant`);
      }
      return createConnector(ctx, {
        kind: body.kind,
        account: body.account,
        scopes: body.scopes,
        tier: body.tier,
        secretRef: body.secretRef,
      });
    });
    return reply.status(201).send(result);
  });

  app.delete(
    '/:kind',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { kind: 'github' } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      await withTenantTransaction(user.tenantId, async (ctx) => {
        const connector = await findConnectorByKind(ctx, request.params.kind);
        if (connector) {
          await deleteConnector(ctx, connector.id);
        }
      });
      return reply.status(204).send();
    }
  );

  app.post(
    '/:kind/actions/:action',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { kind: 'github'; action: string } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = ConnectorActionRequest.parse(request.body);

      if (params.action === 'openPr') {
        return handleOpenPr(reply, user.tenantId, user.userId, body.tier, body.input);
      }

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return connectorRegistry.runAction(ctx, {
          tenantId: user.tenantId,
          kind: params.kind,
          action: params.action,
          input: body.input,
          requestTier: body.tier,
          actor: user.userId,
        });
      });

      return reply.send(result);
    }
  );

  async function handleOpenPr(
    reply: FastifyReply,
    tenantId: string,
    userId: string,
    requestTier: number,
    rawInput: Record<string, unknown>
  ) {
    const input = GitHubOpenPrInput.parse(rawInput);
    const classifier = new ClassificationGateway();

    const { job, classification, decision, approvalId } = await withTenantTransaction(
      tenantId,
      async (ctx) => {
        const connector = await findConnectorByKind(ctx, 'github');
        if (!connector) {
          throw new Error('GitHub connector not configured');
        }

        const classification =
          requestTier !== undefined
            ? {
                tier: requestTier as 0 | 1 | 2,
                confidence: 1,
                reason: 'Tier provided by client',
                fallback: false,
                policyVersion: 'explicit',
              }
            : classifier.classify({
                prompt: [input.title, input.body].join(' '),
                attachments: [],
                retrievedContext: [],
              });

        if (classification.tier < connector.tier) {
          throw new Error(
            `TIER_VIOLATION: PR tier ${classification.tier} is more private than connector tier ${connector.tier}`
          );
        }

        const decision = await evaluateTenantPolicy(ctx, {
          action: 'github.openPr',
          tier: classification.tier,
        });

        await createAuditEvent(ctx, {
          actor: userId,
          action: 'policy_decision',
          tier: classification.tier,
          payload: {
            decision,
            action: 'github.openPr',
          } as unknown as Record<string, unknown>,
        });

        if (decision.effect === 'deny') {
          return { job: null, classification, decision, approvalId: null };
        }

        const job = await createJob(ctx, {
          idempotencyKey: `github-open-pr-${Date.now()}`,
          type: 'github.openPr',
          tier: classification.tier,
          input: { prompt: input.title, payload: input },
        });

        if (decision.effect === 'require_approval') {
          await updateJobStatus(ctx, job.id, 'blocked');
          const approval = await createApproval(ctx, {
            jobId: job.id,
            requestedBy: userId,
            reason: decision.reason,
          });
          await createAuditEvent(ctx, {
            actor: userId,
            action: 'approval_requested',
            tier: classification.tier,
            payload: { approvalId: approval.id, jobId: job.id },
          });
          return { job, classification, decision, approvalId: approval.id };
        }

        await createAuditEvent(ctx, {
          actor: userId,
          action: 'classification_decision',
          tier: classification.tier,
          payload: classification as unknown as Record<string, unknown>,
        });

        return { job, classification, decision, approvalId: null };
      }
    );

    if (decision.effect === 'deny') {
      return reply.status(403).send({
        error: {
          code: 'POLICY_VIOLATION',
          message: decision.reason || 'Policy denied this action',
        },
      });
    }

    if (decision.effect === 'require_approval' && job) {
      return reply.status(202).send({
        jobId: job.id,
        status: job.status,
        approvalId,
      });
    }

    if (!job) {
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
          tenantId,
          userId,
          jobId: job.id,
          idempotencyKey: job.idempotencyKey,
          type: job.type,
          tier: classification.tier,
          payload: input as unknown as Record<string, unknown>,
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
}
