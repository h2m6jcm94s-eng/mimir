import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { findDeviceByApiKeyHash } from '../repositories/device';
import { getNode, updateNodeHeartbeat } from '../repositories/node';

const heartbeatSchema = z.object({
  status: z.enum(['up', 'degraded', 'down']).optional(),
});

function extractApiKey(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice(7);
  return token.startsWith('mimir_') ? token : undefined;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function nodeHealthRoutes(app: FastifyInstance) {
  app.post(
    '/:nodeId/heartbeat',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply) => {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return reply
          .status(401)
          .send({ error: { code: 'UNAUTHORIZED', message: 'Missing node API key' } });
      }

      const { nodeId } = request.params as { nodeId: string };
      const body = heartbeatSchema.parse(request.body);

      const device = await findDeviceByApiKeyHash(hashApiKey(apiKey));
      if (!device || device.id !== nodeId || !device.tenantId) {
        return reply
          .status(401)
          .send({ error: { code: 'UNAUTHORIZED', message: 'Invalid node API key' } });
      }

      const result = await withTenantTransaction(device.tenantId, async (ctx) => {
        const node = await getNode(ctx, nodeId);
        if (!node) return { notFound: true };
        const updated = await updateNodeHeartbeat(ctx, nodeId, body.status ?? 'up');
        return { updated };
      });

      if ('notFound' in result) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send(result.updated);
    }
  );
}
