import { CONNECTOR_SETUP_METADATA } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { secrets } from '../config/secrets';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';

const allowedSecretAliases = new Set(
  Object.values(CONNECTOR_SETUP_METADATA).flatMap((meta) => meta.fields.map((field) => field.key))
);

const paramsSchema = z.object({
  alias: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

const bodySchema = z.object({
  value: z.string().min(1).max(8192),
});

export async function secretsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireScope(Scopes.CONNECTORS_ADMIN));

  app.post(
    '/:alias',
    { config: protectedRouteConfig },
    async (request: FastifyRequest<{ Params: { alias: string } }>, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = bodySchema.parse(request.body);

      if (!allowedSecretAliases.has(params.alias)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_ALIAS',
            message: `Secret alias "${params.alias}" is not a known connector secret alias`,
          },
        });
      }

      await secrets.setForTenant(user.tenantId, params.alias, body.value);

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'secret_set',
          tier: 0,
          payload: { alias: params.alias },
        });
      });

      return reply.status(204).send();
    }
  );
}
