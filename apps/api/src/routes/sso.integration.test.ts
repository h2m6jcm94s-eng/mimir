import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { ssoRoutes } from './sso';

describe('sso provider routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(ssoRoutes, { prefix: '/v1/sso/providers' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sso/providers',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates, lists, updates, and deletes providers',
    async () => {
      const token = `sso_crud_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(ssoRoutes, { prefix: '/v1/sso/providers' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sso/providers',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          kind: 'scim',
          name: 'Okta SCIM',
          status: 'active',
          config: { baseUrl: 'https://example.okta.com' },
        }),
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      expect(createBody.data.name).toBe('Okta SCIM');
      expect(createBody.data.kind).toBe('scim');

      const providerId = createBody.data.id;

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/sso/providers',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: providerId })])
      );

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/sso/providers/${providerId}`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'inactive' }),
      });
      expect(updateResponse.statusCode).toBe(200);
      expect(JSON.parse(updateResponse.body).data.status).toBe('inactive');

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/sso/providers/${providerId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteResponse.statusCode).toBe(204);
    }
  );
});
