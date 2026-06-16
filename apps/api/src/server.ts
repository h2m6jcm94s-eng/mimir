import Fastify from 'fastify';
import { loadConfig } from './config';
import { redis } from './db/redis';
import { authMiddleware, registerAuth } from './middleware/auth';
import { auditRoutes } from './routes/audit';
import { healthRoutes } from './routes/health';
import { sessionRoutes } from './routes/sessions';
import { taskRoutes } from './routes/tasks';
import { getTemporalConnection } from './temporal/client';

const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

async function main() {
  await registerAuth(app);

  // Public health endpoints
  app.register(healthRoutes, { prefix: '/' });

  // Protected API routes
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/v1/')) {
      await authMiddleware(request, reply);
    }
  });

  app.register(sessionRoutes, { prefix: '/v1/sessions' });
  app.register(taskRoutes, { prefix: '/v1/tasks' });
  app.register(auditRoutes, { prefix: '/v1/audit' });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        traceId: 'todo',
      },
    });
  });

  // Pre-warm infrastructure connections; failures here are non-fatal so the
  // server can still answer /livez and /readyz with accurate status.
  try {
    await redis.connect();
    app.log.info('Redis connected');
  } catch (err) {
    app.log.warn({ err }, 'Redis connection failed at startup');
  }

  try {
    await getTemporalConnection();
    app.log.info('Temporal connected');
  } catch (err) {
    app.log.warn({ err }, 'Temporal connection failed at startup');
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
