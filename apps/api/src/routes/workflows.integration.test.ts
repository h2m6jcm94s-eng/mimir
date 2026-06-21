import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { workflowRoutes } from './workflows';

describe('workflows routes', () => {
  it('returns 401 without authorization', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(workflowRoutes, { prefix: '/v1/workflows' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/workflows',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('imports an n8n workflow', async () => {
    const externalId = `workflow_n8n_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(workflowRoutes, { prefix: '/v1/workflows' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/workflows/import/n8n',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Daily Telegram',
        description: 'Imported from n8n',
        n8nWorkflowJson: {
          nodes: [
            {
              name: 'Every day',
              type: 'n8n-nodes-base.scheduleTrigger',
              parameters: { rule: { interval: 1, unit: 'days' } },
              position: [100, 200],
            },
            {
              name: 'Send Telegram',
              type: 'n8n-nodes-base.telegram',
              parameters: { chatId: '123', text: 'Hello' },
              position: [300, 200],
            },
          ],
          connections: {
            'Every day': {
              main: [[{ node: 'Send Telegram', type: 'main', index: 0 }]],
            },
          },
        },
      }),
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.name).toBe('Daily Telegram');
    expect(body.data.sourceFormat).toBe('n8n');
    expect(body.data.workflowJson.nodes).toHaveLength(2);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('generates and optimizes a workflow', async () => {
    const externalId = `workflow_gen_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(workflowRoutes, { prefix: '/v1/workflows' });
    });

    const generateResponse = await app.inject({
      method: 'POST',
      url: '/v1/workflows/generate',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ description: 'Send a slack message every morning', tier: 1 }),
    });
    expect(generateResponse.statusCode).toBe(201);
    const generated = JSON.parse(generateResponse.body).data;
    expect(generated.workflowJson.nodes.some((n: { kind: string }) => n.kind === 'action')).toBe(
      true
    );

    const optimizeResponse = await app.inject({
      method: 'POST',
      url: `/v1/workflows/${generated.id}/optimize`,
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });
    expect(optimizeResponse.statusCode).toBe(200);
    const optimized = JSON.parse(optimizeResponse.body).data;
    expect(optimized.log.length).toBeGreaterThan(0);
  });
});
