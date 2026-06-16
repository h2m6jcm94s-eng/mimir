import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { authMiddleware, registerAuth } from '../middleware/auth';

export async function buildTestApp(
  registerRoutes: (app: FastifyInstance) => Promise<void> | void
): Promise<FastifyInstance> {
  const app = Fastify();
  await registerAuth(app);
  await app.register(rateLimit, {
    max: 10_000,
    timeWindow: '1 minute',
  });
  // lgtm[js/missing-rate-limiting] rate-limit plugin is registered above.
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/v1/')) {
      await authMiddleware(request, reply);
    }
  });
  await registerRoutes(app);
  return app;
}
