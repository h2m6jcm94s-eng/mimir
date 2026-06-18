import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { governanceRoutes } from './governance';

const validPolicy = `rules:
  - action: github.openPr
    effect: require_approval
    reason: opening a PR requires human approval
  - action: '*'
    effect: allow
`;

const invalidPolicy = 'rules: [invalid';

describe('governance routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/governance/policy',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 when no policy has been loaded', async () => {
    const token = `gov_no_policy_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/governance/policy',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('loads and returns a policy', async () => {
    const token = `gov_load_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const putResponse = await app.inject({
      method: 'PUT',
      url: '/v1/governance/policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: validPolicy },
    });

    expect(putResponse.statusCode).toBe(200);
    const putBody = JSON.parse(putResponse.body);
    expect(putBody.data.source).toBe(validPolicy);
    expect(putBody.data.name).toBe('default');

    const getResponse = await app.inject({
      method: 'GET',
      url: '/v1/governance/policy',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getResponse.statusCode).toBe(200);
    const getBody = JSON.parse(getResponse.body);
    expect(getBody.data.source).toBe(validPolicy);
    expect(getBody.data.enabled).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects an invalid policy', async () => {
    const token = `gov_invalid_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/governance/policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: invalidPolicy },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_POLICY');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('translates a natural-language policy to yaml', async () => {
    const token = `gov_translate_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/governance/policy/translate',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ description: 'Require approval for github.openPr' }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.source).toContain('action: "github.openPr"');
    expect(body.data.source).toContain('effect: require_approval');
    expect(body.data.explanations).toEqual(
      expect.arrayContaining(['Require approval for github.openPr.'])
    );
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'fuzzy-matches a typo against the connector registry',
    async () => {
      const token = `gov_fuzzy_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(governanceRoutes, { prefix: '/v1/governance' });
      });

      await resolveAuthUser(token, `${token}@test.local`);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/governance/policy/translate',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({ description: 'Require approval for github.openpr' }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.source).toContain('action: "github.openPr"');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects an untranslatable description', async () => {
    const token = `gov_translate_fail_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(governanceRoutes, { prefix: '/v1/governance' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/governance/policy/translate',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ description: 'just some unrelated text' }),
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_POLICY');
  });
});
