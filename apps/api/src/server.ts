import cors from '@fastify/cors';
import Fastify from 'fastify';
import rateLimit from 'fastify-rate-limit';
import supertokens from 'supertokens-node';
import { plugin as supertokensPlugin } from 'supertokens-node/framework/fastify';
import { initSupertokens } from './auth/supertokens';
import { loadConfig } from './config';
import { redis } from './db/redis';
import { authMiddleware, registerAuth } from './middleware/auth';
import { demoLockoutMiddleware } from './middleware/demo-lockout';
import { agentReputationRoutes } from './routes/agent-reputation';
import { agentRoutes } from './routes/agents';
import { approvalRoutes } from './routes/approvals';
import { auditRoutes } from './routes/audit';
import { briefingRoutes } from './routes/briefings';
import { budgetRoutes } from './routes/budget';
import { captureRoutes } from './routes/capture';
import { chatRoutes } from './routes/chat';
import { cloudWorkerRoutes, cloudWorkerWebhookRoutes } from './routes/cloud-workers';
import { companionRoutes } from './routes/companion';
import { connectorRoutes } from './routes/connectors';
import { demoStatusRoutes } from './routes/demo';
import { emailDigestRoutes } from './routes/email-digest';
import { fencingRoutes } from './routes/fencing';
import { governanceRoutes } from './routes/governance';
import { haltRoutes } from './routes/halt';
import { healthRoutes } from './routes/health';
import { knowledgeRoutes } from './routes/knowledge';
import { knowledgeShareRoutes } from './routes/knowledge-shares';
import { lifeAdminRoutes } from './routes/life-admin';
import { localModelRoutes } from './routes/local-models';
import { marketingRoutes } from './routes/marketing';
import { marketplaceRoutes } from './routes/marketplace';
import { meetingRoutes } from './routes/meetings';
import { memoryRoutes } from './routes/memory';
import { metricsRoutes } from './routes/metrics';
import { modelLeaderboardRoutes } from './routes/model-leaderboard';
import { nodeHealthRoutes } from './routes/node-health';
import { nodeRoutes } from './routes/nodes';
import { notificationRoutes } from './routes/notifications';
import { personalModuleRoutes } from './routes/personal-modules';
import { reportRoutes } from './routes/reports';
import { routineRoutes } from './routes/routines';
import { sandboxRoutes } from './routes/sandbox';
import { schedulingRoutes } from './routes/scheduling';
import { scimRoutes } from './routes/scim';
import { screenTimeRoutes } from './routes/screen-time';
import { sessionRoutes } from './routes/sessions';
import { sshCaRoutes } from './routes/ssh-ca';
import { ssoRoutes } from './routes/sso';
import { taskRoutes } from './routes/tasks';
import { toolsRoutes } from './routes/tools';
import { userRoutes } from './routes/users';
import { valuesRoutes } from './routes/values';
import { workflowRoutes } from './routes/workflows';
import { httpRequestsCounter } from './services/metrics/registry';
import { initializeLibSqlSchema } from './services/state/libsql-schema';
import { ensureDigestSchedule, getTemporalConnection } from './temporal/client';

initSupertokens();
const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
  maxParamLength: 500,
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

  // Public webhooks (registered before the auth hook so they skip session checks).
  app.register(cloudWorkerWebhookRoutes, { prefix: '/webhooks' });
  app.register(nodeHealthRoutes, { prefix: '/health/nodes' });
  app.register(scimRoutes, { prefix: '/scim/v2' });

  // Protected API routes
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/v1/')) {
      await authMiddleware(request, reply);
    }
  });

  // Demo lockout gate (server-side; must run after auth so request.user is set).
  app.addHook('preHandler', async (request, reply) => {
    await demoLockoutMiddleware(request, reply);
  });

  app.register(sessionRoutes, { prefix: '/v1/sessions' });
  app.register(taskRoutes, { prefix: '/v1/tasks' });
  app.register(toolsRoutes, { prefix: '/v1/tools' });
  app.register(nodeRoutes, { prefix: '/v1/nodes' });
  app.register(auditRoutes, { prefix: '/v1/audit' });
  app.register(connectorRoutes, { prefix: '/v1/connectors' });
  app.register(governanceRoutes, { prefix: '/v1/governance' });
  app.register(agentRoutes, { prefix: '/v1/agents' });
  app.register(agentReputationRoutes, { prefix: '/v1/agents/reputation' });
  app.register(approvalRoutes, { prefix: '/v1/approvals' });
  app.register(userRoutes, { prefix: '/v1/users' });
  app.register(budgetRoutes, { prefix: '/v1/budget' });
  app.register(demoStatusRoutes, { prefix: '/v1/demo' });
  app.register(emailDigestRoutes, { prefix: '/v1/email-digest' });
  app.register(companionRoutes, { prefix: '/v1/companion' });
  app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
  app.register(fencingRoutes, { prefix: '/v1/fencing' });
  app.register(briefingRoutes, { prefix: '/v1/briefings' });
  app.register(captureRoutes, { prefix: '/v1/capture' });
  app.register(chatRoutes, { prefix: '/v1/chat' });
  app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
  app.register(knowledgeShareRoutes, { prefix: '/v1/knowledge/shares' });
  app.register(localModelRoutes, { prefix: '/v1/models/local' });
  app.register(lifeAdminRoutes, { prefix: '/v1/life-admin' });
  app.register(marketingRoutes, { prefix: '/v1/marketing' });
  app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
  app.register(meetingRoutes, { prefix: '/v1/meetings' });
  app.register(metricsRoutes, { prefix: '/v1/metrics' });
  app.register(modelLeaderboardRoutes, { prefix: '/v1/models/leaderboard' });
  app.register(memoryRoutes, { prefix: '/v1/memory' });
  app.register(notificationRoutes, { prefix: '/v1/notifications' });
  app.register(personalModuleRoutes, { prefix: '/v1/personal-modules' });
  app.register(reportRoutes, { prefix: '/v1/reports' });
  app.register(routineRoutes, { prefix: '/v1/routines' });
  app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
  app.register(schedulingRoutes, { prefix: '/v1/scheduling' });
  app.register(screenTimeRoutes, { prefix: '/v1/screen-time' });
  app.register(ssoRoutes, { prefix: '/v1/sso/providers' });
  app.register(sshCaRoutes, { prefix: '/v1' });
  app.register(haltRoutes, { prefix: '/v1/halt' });
  app.register(valuesRoutes, { prefix: '/v1/values' });
  app.register(workflowRoutes, { prefix: '/v1/workflows' });

  app.addHook('onResponse', async (request, reply) => {
    const path = request.routeOptions.url ?? request.url.split('?')[0] ?? '/';
    httpRequestsCounter.inc({
      method: request.method,
      status: reply.statusCode,
      path,
    });
  });

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
    await initializeLibSqlSchema();
    app.log.info('LibSQL schema initialized');
  } catch (err) {
    app.log.warn({ err }, 'LibSQL schema initialization failed at startup');
  }

  try {
    await getTemporalConnection();
    app.log.info('Temporal connected');
    try {
      await ensureDigestSchedule({ frequency: 'daily', cron: '0 8 * * *' });
      app.log.info('Daily email digest schedule ensured');
      await ensureDigestSchedule({ frequency: 'weekly', cron: '0 8 * * 1' });
      app.log.info('Weekly email digest schedule ensured');
    } catch (err) {
      app.log.warn({ err }, 'Failed to ensure email digest schedule');
    }
  } catch (err) {
    app.log.warn({ err }, 'Temporal connection failed at startup');
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
