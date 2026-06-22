import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { marketplaceRoutes } from './marketplace';
import { skillRoutes } from './skills';

describe('skill routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(skillRoutes, { prefix: '/v1/skills' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/skills/drafts',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('generates a skill draft and publishes it', async () => {
    const token = `skill_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(skillRoutes, { prefix: '/v1/skills' });
      await app.register(marketplaceRoutes, { prefix: '/v1/marketplace' });
    });

    const generateResponse = await app.inject({
      method: 'POST',
      url: '/v1/skills/drafts',
      headers: { authorization: `Bearer ${token}` },
      payload: { prompt: 'A skill that summarizes my unread emails' },
    });

    expect(generateResponse.statusCode).toBe(201);
    const draft = JSON.parse(generateResponse.body).data;
    expect(draft.status).toBe('draft');
    expect(typeof draft.code).toBe('string');

    const publishResponse = await app.inject({
      method: 'POST',
      url: `/v1/skills/drafts/${draft.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(publishResponse.statusCode).toBe(200);
    expect(JSON.parse(publishResponse.body).data.status).toBe('published');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/marketplace/items',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const items = JSON.parse(listResponse.body).data;
    expect(items.some((item: { id: string }) => item.id === draft.id)).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 for a missing draft', async () => {
    const token = `skill_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(skillRoutes, { prefix: '/v1/skills' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/skills/drafts/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
