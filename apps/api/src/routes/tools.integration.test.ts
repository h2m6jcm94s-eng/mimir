import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { connectorRoutes } from './connectors';
import { toolsRoutes } from './tools';

describe('tools routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(toolsRoutes, { prefix: '/v1/tools' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tools',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates, lists, updates, and deletes tools', async () => {
    const token = `tools_crud_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(toolsRoutes, { prefix: '/v1/tools' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/tools',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'List repos',
        description: 'Lists GitHub repositories',
        action: 'github.listRepos',
        fields: [{ name: 'perPage', label: 'Per page', type: 'number', required: false }],
      }),
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.body);
    expect(createBody.data.name).toBe('List repos');
    expect(createBody.data.action).toBe('github.listRepos');
    expect(createBody.data.fields).toHaveLength(1);

    const toolId = createBody.data.id;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/tools',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: toolId })])
    );

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/tools/${toolId}`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ status: 'active' }),
    });
    expect(updateResponse.statusCode).toBe(200);
    const updateBody = JSON.parse(updateResponse.body);
    expect(updateBody.data.status).toBe('active');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/tools/${toolId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'runs an active read tool through the connector registry',
    async () => {
      const token = `tools_run_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(toolsRoutes, { prefix: '/v1/tools' });
        await app.register(connectorRoutes, { prefix: '/v1/connectors' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_GITHUB_${user.tenantId}`] = 'test-token';

      await app.inject({
        method: 'POST',
        url: '/v1/connectors',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          kind: 'github',
          account: 'acme',
          secretRef: 'github',
          scopes: ['repo'],
          tier: 1,
        }),
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, full_name: 'acme/repo' }],
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/tools',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'List repos',
          action: 'github.listRepos',
          status: 'active',
          fields: [{ name: 'perPage', label: 'Per page', type: 'number', required: false }],
        }),
      });
      expect(createResponse.statusCode).toBe(201);
      const toolId = JSON.parse(createResponse.body).data.id;

      const runResponse = await app.inject({
        method: 'POST',
        url: `/v1/tools/${toolId}/run`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({ input: { perPage: 10 } }),
      });

      expect(runResponse.statusCode).toBe(200);
      const runBody = JSON.parse(runResponse.body);
      expect(runBody.data.result.repos).toEqual([{ id: 1, full_name: 'acme/repo' }]);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects running a draft tool', async () => {
    const token = `tools_draft_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(toolsRoutes, { prefix: '/v1/tools' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/tools',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Draft tool',
        action: 'github.listRepos',
        status: 'draft',
        fields: [],
      }),
    });
    expect(createResponse.statusCode).toBe(201);
    const toolId = JSON.parse(createResponse.body).data.id;

    const runResponse = await app.inject({
      method: 'POST',
      url: `/v1/tools/${toolId}/run`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ input: {} }),
    });

    expect(runResponse.statusCode).toBe(400);
    const runBody = JSON.parse(runResponse.body);
    expect(runBody.error.code).toBe('TOOL_EXECUTION_FAILED');
  });
});
