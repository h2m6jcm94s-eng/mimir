import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { registerAuth } from '../middleware/auth';
import { agentReputationRoutes } from '../routes/agent-reputation';
import { agentRoutes } from '../routes/agents';
import { approvalRoutes } from '../routes/approvals';
import { auditRoutes } from '../routes/audit';
import { briefingRoutes } from '../routes/briefings';
import { budgetRoutes } from '../routes/budget';
import { captureRoutes } from '../routes/capture';
import { chatRoutes } from '../routes/chat';
import { cloudWorkerRoutes, cloudWorkerWebhookRoutes } from '../routes/cloud-workers';
import { companionRoutes } from '../routes/companion';
import { connectorRoutes } from '../routes/connectors';
import { demoStatusRoutes } from '../routes/demo';
import { emailDigestRoutes } from '../routes/email-digest';
import { fencingRoutes } from '../routes/fencing';
import { governanceRoutes } from '../routes/governance';
import { haltRoutes } from '../routes/halt';
import { healthRoutes } from '../routes/health';
import { knowledgeRoutes } from '../routes/knowledge';
import { knowledgeShareRoutes } from '../routes/knowledge-shares';
import { lifeAdminRoutes } from '../routes/life-admin';
import { localModelRoutes } from '../routes/local-models';
import { marketingRoutes } from '../routes/marketing';
import { marketplaceRoutes } from '../routes/marketplace';
import { meetingRoutes } from '../routes/meetings';
import { memoryRoutes } from '../routes/memory';
import { metricsRoutes } from '../routes/metrics';
import { modelLeaderboardRoutes } from '../routes/model-leaderboard';
import { nodeHealthRoutes } from '../routes/node-health';
import { nodeRoutes } from '../routes/nodes';
import { notificationRoutes } from '../routes/notifications';
import { personalModuleRoutes } from '../routes/personal-modules';
import { remediationRoutes } from '../routes/remediation';
import { reportRoutes } from '../routes/reports';
import { routineRoutes } from '../routes/routines';
import { sandboxRoutes } from '../routes/sandbox';
import { schedulingRoutes } from '../routes/scheduling';
import { scimRoutes } from '../routes/scim';
import { screenTimeRoutes } from '../routes/screen-time';
import { sessionRoutes } from '../routes/sessions';
import { skillRoutes } from '../routes/skills';
import { sshCaRoutes } from '../routes/ssh-ca';
import { ssoRoutes } from '../routes/sso';
import { taskRoutes } from '../routes/tasks';
import { toolsRoutes } from '../routes/tools';
import { userRoutes } from '../routes/users';
import { valuesRoutes } from '../routes/values';
import { workflowRoutes } from '../routes/workflows';

async function main() {
  const app = Fastify({ logger: false });

  await registerAuth(app);
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Mimir API',
        version: '0.0.1',
        description: 'Privacy-tiered AI orchestration mesh',
      },
      servers: [{ url: 'http://localhost:3001' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  app.register(healthRoutes, { prefix: '/' });
  app.register(cloudWorkerWebhookRoutes, { prefix: '/webhooks' });
  app.register(nodeHealthRoutes, { prefix: '/health/nodes' });
  app.register(scimRoutes, { prefix: '/scim/v2' });

  app.register(agentRoutes, { prefix: '/v1/agents' });
  app.register(agentReputationRoutes, { prefix: '/v1/agents/reputation' });
  app.register(approvalRoutes, { prefix: '/v1/approvals' });
  app.register(auditRoutes, { prefix: '/v1/audit' });
  app.register(briefingRoutes, { prefix: '/v1/briefings' });
  app.register(budgetRoutes, { prefix: '/v1/budget' });
  app.register(captureRoutes, { prefix: '/v1/capture' });
  app.register(chatRoutes, { prefix: '/v1/chat' });
  app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
  app.register(companionRoutes, { prefix: '/v1/companion' });
  app.register(connectorRoutes, { prefix: '/v1/connectors' });
  app.register(demoStatusRoutes, { prefix: '/v1/demo' });
  app.register(emailDigestRoutes, { prefix: '/v1/email-digest' });
  app.register(fencingRoutes, { prefix: '/v1/fencing' });
  app.register(governanceRoutes, { prefix: '/v1/governance' });
  app.register(haltRoutes, { prefix: '/v1/halt' });
  app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
  app.register(knowledgeShareRoutes, { prefix: '/v1/knowledge/shares' });
  app.register(lifeAdminRoutes, { prefix: '/v1/life-admin' });
  app.register(localModelRoutes, { prefix: '/v1/models/local' });
  app.register(modelLeaderboardRoutes, { prefix: '/v1/models/leaderboard' });
  app.register(marketingRoutes, { prefix: '/v1/marketing' });
  app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
  app.register(meetingRoutes, { prefix: '/v1/meetings' });
  app.register(memoryRoutes, { prefix: '/v1/memory' });
  app.register(metricsRoutes, { prefix: '/v1/metrics' });
  app.register(nodeRoutes, { prefix: '/v1/nodes' });
  app.register(notificationRoutes, { prefix: '/v1/notifications' });
  app.register(personalModuleRoutes, { prefix: '/v1/personal-modules' });
  app.register(remediationRoutes, { prefix: '/v1/remediations' });
  app.register(reportRoutes, { prefix: '/v1/reports' });
  app.register(routineRoutes, { prefix: '/v1/routines' });
  app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
  app.register(schedulingRoutes, { prefix: '/v1/scheduling' });
  app.register(screenTimeRoutes, { prefix: '/v1/screen-time' });
  app.register(sessionRoutes, { prefix: '/v1/sessions' });
  app.register(skillRoutes, { prefix: '/v1/skills' });
  app.register(ssoRoutes, { prefix: '/v1/sso/providers' });
  app.register(sshCaRoutes, { prefix: '/v1' });
  app.register(taskRoutes, { prefix: '/v1/tasks' });
  app.register(toolsRoutes, { prefix: '/v1/tools' });
  app.register(userRoutes, { prefix: '/v1/users' });
  app.register(valuesRoutes, { prefix: '/v1/values' });
  app.register(workflowRoutes, { prefix: '/v1/workflows' });

  await app.ready();

  const spec = app.swagger();
  const output = path.resolve(__dirname, '../../openapi.json');
  await writeFile(output, `${JSON.stringify(spec, null, 2)}\n`);

  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
