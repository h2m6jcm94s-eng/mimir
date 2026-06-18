import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { memoryRoutes } from './memory';

describe('relationship memory routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(memoryRoutes, { prefix: '/v1/memory' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/memory/relationships',
    });

    expect(response.statusCode).toBe(401);
  });

  // Skipped until the local dev database has the F-016 memory graph tables
  // (memory_node, memory_edge, memory_checkpoint). The current DB is missing
  // these tables even though the migration is recorded as applied.
  it.skip('creates and lists relationship memories', async () => {
    const externalId = `relationship_memory_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(memoryRoutes, { prefix: '/v1/memory' });
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/memory/relationships',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Sarah',
        relationship: 'friend',
        notes: 'Loves hiking and sourdough bread.',
        preferences: { gift: 'books', coffee: 'oat latte' },
      }),
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.body);
    expect(createBody.data.name).toBe('Sarah');
    expect(createBody.data.relationship).toBe('friend');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/memory/relationships',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toBeInstanceOf(Array);
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].name).toBe('Sarah');
    expect(listBody.data[0].preferences.gift).toBe('books');
  });
});
