import cors from '@fastify/cors';
import Fastify from 'fastify';
import rateLimit from 'fastify-rate-limit';
import supertokens from 'supertokens-node';
import { plugin as supertokensPlugin } from 'supertokens-node/framework/fastify';
import { initSupertokens } from './auth/supertokens';
import { loadConfig } from './config';
import { redis } from './db/redis';
import { authMiddleware, registerAuth } from './middleware/auth';
import { auditRoutes } from './routes/audit';
import { haltRoutes } from './routes/halt';
import { healthRoutes } from './routes/health';
import { knowledgeRoutes } from './routes/knowledge';
import { nodeRoutes } from './routes/nodes';
import { sessionRoutes } from './routes/sessions';
import { taskRoutes } from './routes/tasks';
import { getTemporalConnection } from './temporal/client';

initSupertokens();
const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

async function main() {
  await app.register(cors, {
    origin: config.webAppDomain,
    allowedHeaders: ['Content-Type', 'Authorization', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  await app.register(supertokensPlugin);
  await registerAuth(app);

  // Rate limit all routes (in-memory store; Redis store can be wired later).
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

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
  app.register(nodeRoutes, { prefix: '/v1/nodes' });
  app.register(auditRoutes, { prefix: '/v1/audit' });
  app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
  app.register(haltRoutes, { prefix: '/v1/halt' });

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
