import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { marketplaceRoutes } from './marketplace';

describe('marketplace routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/marketplace/items',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('lists catalog items with installed flags', async () => {
    const token = `marketplace_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/marketplace/items',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty('installed');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('installs and uninstalls an item', async () => {
    const token = `marketplace_install_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
    });

    const itemId = 'meeting-notes-pro';
    const installResponse = await app.inject({
      method: 'POST',
      url: `/v1/marketplace/items/${encodeURIComponent(itemId)}/install`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(installResponse.statusCode).toBe(201);
    const installBody = JSON.parse(installResponse.body);
    expect(installBody.data.installed).toBe(true);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/marketplace/items',
      headers: { authorization: `Bearer ${token}` },
    });
    const listBody = JSON.parse(listResponse.body);
    const item = listBody.data.find((i: { id: string }) => i.id === itemId);
    expect(item.installed).toBe(true);

    const uninstallResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/marketplace/installs/${encodeURIComponent(itemId)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(uninstallResponse.statusCode).toBe(204);
  });
});
