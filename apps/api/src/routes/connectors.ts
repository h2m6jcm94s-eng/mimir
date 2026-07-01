import { randomUUID } from 'node:crypto';
import {
  CONNECTOR_SETUP_METADATA,
  ConnectorActionRequest,
  ConnectorKind,
  ConnectorOAuthCallbackRequest,
  type ConnectorOAuthUrlResponse,
  CreateConnectorRequest,
} from '@mimir/shared-types';
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
import { createJob, updateJobStatus } from '../repositories/job';
import { approvalExpiresAt, buildBlastRadius, riskFromTier } from '../services/approvals/metadata';
import { getClassificationGateway } from '../services/classification/gateway';
import '../services/connectors/airtable/handlers';
import '../services/connectors/csv/handlers';
import '../services/connectors/discord/handlers';
import '../services/connectors/facebook/handlers';
import '../services/connectors/github/apply';
import '../services/connectors/gmail/handlers';
import '../services/connectors/googleContacts/handlers';
import '../services/connectors/googleDocs/handlers';
import '../services/connectors/googleSheets/handlers';
import '../services/connectors/instagram/handlers';
import '../services/connectors/microsoftGraph/handlers';
import '../services/connectors/xlsx/handlers';
import { connectorRegistry } from '../services/connectors/registry';
import { startTaskWorkflow } from '../temporal/client';
import '../services/connectors/pinterest/handlers';
import '../services/connectors/slack/handlers';
import '../services/connectors/telegram/handlers';
import '../services/connectors/whatsapp/handlers';
import {
  buildGoogleAuthorizationUrl,
  completeGoogleOAuth,
  isGoogleConnectorKind,
} from '../services/connectors/google/oauth';
import {
  buildNotionAuthorizationUrl,
  completeNotionOAuth,
} from '../services/connectors/notion/oauth';
import { connectorWriteRegistry } from '../services/connectors/write-registry';
import { BudgetExceededError, BudgetService, BudgetThrottledError } from '../services/cost/budget';
import { evaluateTenantPolicy } from '../services/governance/engine';

const budgetService = new BudgetService();

const paramsSchema = z.object({
  kind: ConnectorKind,
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
    async (request: FastifyRequest<{ Params: { kind: z.infer<typeof ConnectorKind> } }>, reply) => {
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
    '/:kind/test',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { kind: z.infer<typeof ConnectorKind> } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const kind = request.params.kind;
      const metadata = CONNECTOR_SETUP_METADATA[kind];
      const testAction = metadata?.testAction;
      if (!testAction) {
        return reply.status(400).send({
          error: {
            code: 'NO_TEST_ACTION',
            message: `No connection test configured for ${kind}`,
          },
        });
      }

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        return connectorRegistry.testConnection(
          ctx,
          user.tenantId,
          kind,
          testAction.action,
          testAction.input
        );
      });

      if (result.ok) {
        return reply.send({ ok: true });
      }
      return reply.status(422).send({ ok: false, error: result.error });
    }
  );

  app.get(
    '/:kind/oauth/url',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { kind: z.infer<typeof ConnectorKind> } }>, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const kind = request.params.kind;
      const metadata = CONNECTOR_SETUP_METADATA[kind];
      if (!metadata?.oauthAvailable) {
        return reply.status(400).send({
          error: {
            code: 'OAUTH_NOT_AVAILABLE',
            message: `OAuth is not available for ${kind}`,
          },
        });
      }

      try {
        if (kind === 'notion') {
          const { url } = await buildNotionAuthorizationUrl(user.tenantId);
          const response: z.infer<typeof ConnectorOAuthUrlResponse> = { url };
          return reply.send(response);
        }

        if (isGoogleConnectorKind(kind)) {
          const { url } = await buildGoogleAuthorizationUrl(user.tenantId, kind);
          const response: z.infer<typeof ConnectorOAuthUrlResponse> = { url };
          return reply.send(response);
        }

        return reply.status(501).send({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: `OAuth flow for ${kind} is not implemented yet`,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          error: {
            code: 'OAUTH_INIT_FAILED',
            message,
          },
        });
      }
    }
  );

  app.post(
    '/:kind/oauth/callback',
    { config: protectedRouteConfig },
    async (
      request: FastifyRequest<{
        Params: { kind: z.infer<typeof ConnectorKind> };
        Body: { code: string; state: string };
      }>,
      reply
    ) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const kind = request.params.kind;
      const metadata = CONNECTOR_SETUP_METADATA[kind];
      if (!metadata?.oauthAvailable) {
        return reply.status(400).send({
          error: {
            code: 'OAUTH_NOT_AVAILABLE',
            message: `OAuth is not available for ${kind}`,
          },
        });
      }

      const body = ConnectorOAuthCallbackRequest.parse(request.body);

      try {
        const connector = await withTenantTransaction(user.tenantId, async (ctx) => {
          if (kind === 'notion') {
            return completeNotionOAuth(ctx, body.code, body.state);
          }
          if (isGoogleConnectorKind(kind)) {
            return completeGoogleOAuth(ctx, kind, body.code, body.state);
          }
          throw new Error(`OAuth flow for ${kind} is not implemented yet`);
        });
        return reply.send({ data: connector });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = message.startsWith('INVALID_OAUTH_STATE')
          ? 'INVALID_OAUTH_STATE'
          : message.startsWith('TENANT_MISMATCH')
            ? 'TENANT_MISMATCH'
            : 'OAUTH_CALLBACK_FAILED';
        return reply.status(400).send({
          error: { code, message },
        });
      }
    }
  );

  app.post(
    '/:kind/actions/:action',
    { config: protectedRouteConfig },
    async (
      request: FastifyRequest<{ Params: { kind: z.infer<typeof ConnectorKind>; action: string } }>,
      reply
    ) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = ConnectorActionRequest.parse(request.body);

      if (connectorWriteRegistry.has(params.kind, params.action)) {
        return handleConnectorWrite(
          reply,
          user.tenantId,
          user.userId,
          params.kind,
          params.action,
          body.tier,
          body.input
        );
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

  async function handleConnectorWrite(
    reply: FastifyReply,
    tenantId: string,
    userId: string,
    kind: z.infer<typeof ConnectorKind>,
    action: string,
    requestTier: number,
    rawInput: Record<string, unknown>
  ) {
    const descriptor = connectorWriteRegistry.get(kind, action);
    if (!descriptor) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Write action ${kind}.${action} not found` },
      });
    }

    const input = descriptor.inputSchema.parse(rawInput);
    const preview = descriptor.preview(input);
    const classifier = getClassificationGateway();

    const { job, classification, decision, approvalId, budgetError } = await withTenantTransaction(
      tenantId,
      async (ctx) => {
        const connector = await findConnectorByKind(ctx, kind);
        if (!connector) {
          throw new Error(`${kind} connector not configured`);
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
                prompt: preview,
                attachments: [],
                retrievedContext: [],
              });

        if (classification.tier < connector.tier) {
          throw new Error(
            `TIER_VIOLATION: request tier ${classification.tier} is more private than connector tier ${connector.tier}`
          );
        }

        try {
          await budgetService.checkAction(ctx, {
            tier: classification.tier,
            projectedCostUsd: 0,
            actor: userId,
          });
        } catch (error) {
          if (error instanceof BudgetExceededError || error instanceof BudgetThrottledError) {
            return {
              job: null,
              classification,
              decision: null,
              approvalId: null,
              budgetError: error,
            };
          }
          throw error;
        }

        const actionName = `${kind}.${action}`;
        const decision = await evaluateTenantPolicy(ctx, {
          action: actionName,
          tier: classification.tier,
          source: 'api',
        });

        await createAuditEvent(ctx, {
          actor: userId,
          action: 'policy_decision',
          tier: classification.tier,
          payload: {
            decision,
            action: actionName,
          } as unknown as Record<string, unknown>,
        });

        if (decision.effect === 'deny') {
          return { job: null, classification, decision, approvalId: null, budgetError: null };
        }

        const job = await createJob(ctx, {
          idempotencyKey: `${kind}-${action}-${randomUUID()}`,
          type: actionName,
          tier: classification.tier,
          source: 'api',
          input: { prompt: preview, payload: input },
        });

        if (decision.effect === 'require_approval') {
          await updateJobStatus(ctx, job.id, 'blocked');
          const approvalMessage = descriptor.approvalMessage(input);
          const approvalReason = [
            decision.reason,
            `${approvalMessage.title}: ${approvalMessage.description}`,
          ]
            .filter(Boolean)
            .join('. ');
          const approval = await createApproval(ctx, {
            jobId: job.id,
            requestedBy: userId,
            reason: approvalReason,
            risk: riskFromTier(classification.tier),
            blastRadius: buildBlastRadius({
              tier: classification.tier,
              action: actionName,
              connectors: [kind],
              summary: approvalMessage.description || approvalMessage.title,
            }),
            expiresAt: approvalExpiresAt(classification.tier),
          });
          await createAuditEvent(ctx, {
            actor: userId,
            action: 'approval_requested',
            tier: classification.tier,
            payload: { approvalId: approval.id, jobId: job.id },
          });
          return { job, classification, decision, approvalId: approval.id, budgetError: null };
        }

        await createAuditEvent(ctx, {
          actor: userId,
          action: 'classification_decision',
          tier: classification.tier,
          payload: classification as unknown as Record<string, unknown>,
        });

        return { job, classification, decision, approvalId: null, budgetError: null };
      }
    );

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

    const run = await startTaskWorkflow({
      tenantId,
      userId,
      jobId: job.id,
      idempotencyKey: job.idempotencyKey,
      type: job.type,
      tier: classification.tier,
      source: 'api',
      payload: input as unknown as Record<string, unknown>,
    });

    return reply.status(201).send({
      jobId: job.id,
      workflowId: run.workflowId,
      runId: run.runId,
      status: job.status,
    });
  }
}
