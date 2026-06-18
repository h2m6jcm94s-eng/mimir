import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import { updateJobStatus } from '../repositories/job';
import { provisionCloudWorker } from '../services/cloud-worker/provision';
import { type ReturnTokenPayload, consumeReturnToken } from '../services/cloud-worker/token';
import { publishJobEvent } from '../services/events/publisher';

const provisionSchema = z.object({
  jobId: z.string().uuid(),
  amiId: z.string().optional(),
  instanceType: z.string().optional(),
  region: z.string().optional(),
});

const returnSchema = z.object({
  exitCode: z.number().int().min(0).default(0),
  result: z.unknown().optional(),
  stderr: z.string().optional(),
});

export async function cloudWorkerRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CLOUD_WORKERS_ADMIN) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = provisionSchema.parse(request.body);
      const webhookBaseUrl =
        process.env.CLOUD_WORKER_WEBHOOK_BASE_URL || `${process.env.AUTH_DOMAIN || ''}`;
      if (!webhookBaseUrl) {
        return reply.status(500).send({
          error: { code: 'NOT_CONFIGURED', message: 'CLOUD_WORKER_WEBHOOK_BASE_URL is not set' },
        });
      }

      const provisioned = await provisionCloudWorker({
        tenantId: user.tenantId,
        jobId: body.jobId,
        amiId: body.amiId,
        instanceType: body.instanceType,
        region: body.region,
        webhookBaseUrl,
      });

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'cloud_worker_provisioned',
          tier: 2,
          payload: { jobId: body.jobId, instanceId: provisioned.instanceId },
        });
      });

      return reply.status(201).send(provisioned);
    }
  );
}

export async function cloudWorkerWebhookRoutes(app: FastifyInstance) {
  app.post('/cloud-workers/return/:token', async (request: FastifyRequest, reply) => {
    const { token } = request.params as { token: string };
    const body = returnSchema.parse(request.body);

    let payload: ReturnTokenPayload;
    try {
      payload = await consumeReturnToken(token);
    } catch (error) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_TOKEN',
          message: error instanceof Error ? error.message : 'Invalid token',
        },
      });
    }

    await withTenantTransaction(payload.tenantId, async (ctx) => {
      const status = body.exitCode === 0 ? 'done' : 'failed';
      await updateJobStatus(ctx, payload.jobId, status, {
        result: {
          exitCode: body.exitCode,
          result: body.result,
          stderr: body.stderr,
        },
      });
      await publishJobEvent(ctx, {
        jobId: payload.jobId,
        type: 'cloud_worker_returned',
        payload: { exitCode: body.exitCode },
      });
    });

    return reply.send({ ok: true });
  });
}
