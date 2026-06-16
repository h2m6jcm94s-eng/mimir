import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Scopes, requireScope } from '../middleware/rbac';
import { strictRouteConfig } from '../middleware/route-config';
import { clearHalt, getHaltState, setHalted } from '../services/halt/state';

const setHaltSchema = z.object({
  reason: z.string().min(1).default('Emergency halt triggered'),
});

export async function haltRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { config: strictRouteConfig, preHandler: requireScope(Scopes.HALT_READ) },
    async () => {
      return getHaltState();
    }
  );

  app.post<{ Body: { reason?: string } }>(
    '/',
    { config: strictRouteConfig, preHandler: requireScope(Scopes.HALT_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = setHaltSchema.parse(request.body);
      await setHalted(body.reason, user.userId);
      return getHaltState();
    }
  );

  app.delete(
    '/',
    { config: strictRouteConfig, preHandler: requireScope(Scopes.HALT_WRITE) },
    async () => {
      await clearHalt();
      return { halted: false };
    }
  );
}
