import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { registerAuth } from '../middleware/auth';
import { auditRoutes } from '../routes/audit';
import { connectorRoutes } from '../routes/connectors';
import { healthRoutes } from '../routes/health';
import { sessionRoutes } from '../routes/sessions';
import { taskRoutes } from '../routes/tasks';

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
  app.register(sessionRoutes, { prefix: '/v1/sessions' });
  app.register(taskRoutes, { prefix: '/v1/tasks' });
  app.register(auditRoutes, { prefix: '/v1/audit' });
  app.register(connectorRoutes, { prefix: '/v1/connectors' });

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
