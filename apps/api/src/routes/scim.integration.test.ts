import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { scimRoutes } from './scim';
import { ssoRoutes } from './sso';

describe('scim routes', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('provisions and manages users via SCIM 2.0', async () => {
    const token = `scim_lifecycle_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(ssoRoutes, { prefix: '/v1/sso/providers' });
      await app.register(scimRoutes, { prefix: '/scim/v2' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const providerResponse = await app.inject({
      method: 'POST',
      url: '/v1/sso/providers',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        kind: 'scim',
        name: 'Okta SCIM',
        status: 'active',
      }),
    });
    expect(providerResponse.statusCode).toBe(201);
    const providerId = JSON.parse(providerResponse.body).data.id;

    const tokenResponse = await app.inject({
      method: 'POST',
      url: `/v1/sso/providers/${providerId}/tokens`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'test token' }),
    });
    expect(tokenResponse.statusCode).toBe(201);
    const scimToken = JSON.parse(tokenResponse.body).data.token;

    const createResponse = await app.inject({
      method: 'POST',
      url: '/scim/v2/Users',
      headers: { authorization: `Bearer ${scimToken}`, 'content-type': 'application/scim+json' },
      payload: JSON.stringify({
        userName: 'alice@example.com',
        name: { givenName: 'Alice', familyName: 'Smith' },
        emails: [{ value: 'alice@example.com', primary: true }],
        active: true,
      }),
    });
    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.body);
    expect(createBody.userName).toBe('alice@example.com');
    expect(createBody.active).toBe(true);

    const userId = createBody.id;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/scim/v2/Users',
      headers: { authorization: `Bearer ${scimToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.totalResults).toBeGreaterThanOrEqual(1);
    expect(listBody.Resources).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: userId })])
    );

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/scim/v2/Users/${userId}`,
      headers: { authorization: `Bearer ${scimToken}`, 'content-type': 'application/scim+json' },
      payload: JSON.stringify({
        Operations: [{ op: 'Replace', path: 'active', value: false }],
      }),
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(JSON.parse(patchResponse.body).active).toBe(false);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/scim/v2/Users/${userId}`,
      headers: { authorization: `Bearer ${scimToken}` },
    });
    expect(deleteResponse.statusCode).toBe(204);
  });
});
