import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { listAuditEvents } from '../repositories/audit';
import { buildTestApp } from '../test-helpers/build-app';
import { connectorRoutes } from './connectors';

describe('connectors routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(connectorRoutes, { prefix: '/v1/connectors' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/connectors',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'connects a GitHub connector and runs read actions',
    async () => {
      const token = `connector_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(connectorRoutes, { prefix: '/v1/connectors' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_GITHUB_${user.tenantId}`] = 'test-token';

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/connectors',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'github',
          account: 'acme',
          secretRef: 'github',
          scopes: ['repo'],
          tier: 1,
        },
      });
      expect(connectResponse.statusCode).toBe(201);
      const connector = JSON.parse(connectResponse.body);
      expect(connector.kind).toBe('github');
      expect(connector.tier).toBe(1);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, full_name: 'acme/repo' }],
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const actionResponse = await app.inject({
        method: 'POST',
        url: '/v1/connectors/github/actions/listRepos',
        headers: { authorization: `Bearer ${token}` },
        payload: { tier: 1, input: { perPage: 10 } },
      });
      expect(actionResponse.statusCode).toBe(200);
      const actionBody = JSON.parse(actionResponse.body);
      expect(actionBody.success).toBe(true);
      expect(actionBody.result.repos).toEqual([{ id: 1, full_name: 'acme/repo' }]);

      const violationResponse = await app.inject({
        method: 'POST',
        url: '/v1/connectors/github/actions/listRepos',
        headers: { authorization: `Bearer ${token}` },
        payload: { tier: 0, input: {} },
      });
      expect(violationResponse.statusCode).toBe(500);

      const audit = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listAuditEvents(ctx, { limit: 10 });
      });
      const connectorAction = audit.data.find((e) => e.action === 'connector_action');
      expect(connectorAction).toBeDefined();
      expect(connectorAction?.tier).toBe(1);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: '/v1/connectors/github',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteResponse.statusCode).toBe(204);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('queues an openPr job', async () => {
    const token = `connector_openpr_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(connectorRoutes, { prefix: '/v1/connectors' });
    });

    const user = await resolveAuthUser(token, `${token}@test.local`);
    process.env[`MIMIR_SECRET_GITHUB_${user.tenantId}`] = 'test-token';

    await app.inject({
      method: 'POST',
      url: '/v1/connectors',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'github',
        secretRef: 'github',
        scopes: ['repo'],
        tier: 1,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/connectors/github/actions/openPr',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tier: 1,
        input: {
          owner: 'acme',
          repo: 'app',
          title: 'Fix bug',
          body: 'Details',
          head: 'feature',
          base: 'main',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBeDefined();
    expect(body.workflowId).toBeDefined();
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('queues a telegram sendMessage job', async () => {
    const token = `connector_telegram_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(connectorRoutes, { prefix: '/v1/connectors' });
    });

    const user = await resolveAuthUser(token, `${token}@test.local`);
    process.env[`MIMIR_SECRET_TELEGRAM_${user.tenantId}`] = 'test-token';

    await app.inject({
      method: 'POST',
      url: '/v1/connectors',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'telegram',
        secretRef: 'telegram',
        scopes: [],
        tier: 1,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/connectors/telegram/actions/sendMessage',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tier: 1,
        input: { chatId: '@channel', text: 'Hello from Mimir' },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBeDefined();
    expect(body.workflowId).toBeDefined();
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('queues a facebook publishPost job', async () => {
    const token = `connector_facebook_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(connectorRoutes, { prefix: '/v1/connectors' });
    });

    const user = await resolveAuthUser(token, `${token}@test.local`);
    process.env[`MIMIR_SECRET_FACEBOOK_${user.tenantId}`] = 'test-token';

    await app.inject({
      method: 'POST',
      url: '/v1/connectors',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'facebook',
        secretRef: 'facebook',
        scopes: [],
        tier: 1,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/connectors/facebook/actions/publishPost',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tier: 1,
        input: { pageId: 'page1', message: 'Hello from Mimir' },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBeDefined();
    expect(body.workflowId).toBeDefined();
  });

  const newWriteConnectors: Array<{
    kind: string;
    action: string;
    input: Record<string, unknown>;
  }> = [
    {
      kind: 'gmail',
      action: 'sendMessage',
      input: { to: 'a@example.com', subject: 'Hi', body: 'Hello' },
    },
    {
      kind: 'microsoftGraph',
      action: 'sendMessage',
      input: { to: 'a@example.com', subject: 'Hi', body: 'Hello' },
    },
    {
      kind: 'googleContacts',
      action: 'createContact',
      input: { givenName: 'Ada', email: 'ada@example.com' },
    },
    { kind: 'googleDocs', action: 'createDocument', input: { title: 'Notes' } },
    { kind: 'discord', action: 'sendMessage', input: { channelId: '123', content: 'hi' } },
    { kind: 'slack', action: 'sendMessage', input: { channelId: '#general', text: 'hi' } },
  ];

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'queues write-action jobs for F-019/F-020/F-021 connectors',
    async () => {
      for (const { kind, action, input } of newWriteConnectors) {
        const token = `connector_${kind}_${Date.now()}`;
        const app = await buildTestApp(async (app) => {
          await app.register(connectorRoutes, { prefix: '/v1/connectors' });
        });

        const user = await resolveAuthUser(token, `${token}@test.local`);
        process.env[`MIMIR_SECRET_${kind.toUpperCase()}_${user.tenantId}`] = 'test-token';

        const connectResponse = await app.inject({
          method: 'POST',
          url: '/v1/connectors',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            kind,
            secretRef: kind,
            scopes: [],
            tier: 1,
          },
        });
        expect(connectResponse.statusCode).toBe(201);

        const response = await app.inject({
          method: 'POST',
          url: `/v1/connectors/${kind}/actions/${action}`,
          headers: { authorization: `Bearer ${token}` },
          payload: { tier: 1, input },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.jobId).toBeDefined();
        expect(body.workflowId).toBeDefined();
      }
    }
  );
});
