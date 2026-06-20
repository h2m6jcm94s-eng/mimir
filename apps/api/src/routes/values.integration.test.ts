import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { valuesRoutes } from './values';

describe('values routes', () => {
  it('returns 401 without authorization', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(valuesRoutes, { prefix: '/v1/values' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/values',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates and updates values', async () => {
    const externalId = `values_user_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(valuesRoutes, { prefix: '/v1/values' });
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/values',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Health',
        description: 'Physical and mental wellbeing',
        weight: 8,
      }),
    });
    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.body);
    expect(createBody.data.name).toBe('Health');
    expect(createBody.data.weight).toBe(8);

    const valueId = createBody.data.id;

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/values/${valueId}`,
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ weight: 9 }),
    });
    expect(updateResponse.statusCode).toBe(200);
    const updateBody = JSON.parse(updateResponse.body);
    expect(updateBody.data.weight).toBe(9);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/values',
      headers: { authorization: `Bearer ${externalId}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data).toHaveLength(1);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/values/${valueId}`,
      headers: { authorization: `Bearer ${externalId}` },
    });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('logs a decision and computes alignment', async () => {
    const externalId = `values_decision_${Date.now()}`;
    await resolveAuthUser(externalId, `${externalId}@test.local`);

    const app = await buildTestApp(async (app) => {
      await app.register(valuesRoutes, { prefix: '/v1/values' });
    });

    const valueResponse = await app.inject({
      method: 'POST',
      url: '/v1/values',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Health', description: '', weight: 10 }),
    });
    const value = JSON.parse(valueResponse.body).data;

    const decisionResponse = await app.inject({
      method: 'POST',
      url: '/v1/values/decisions',
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        title: 'Morning routine',
        context: 'Choose workout or sleep in',
        options: [
          { label: 'Workout', description: '' },
          { label: 'Sleep in', description: '' },
        ],
        chosenOption: 'Workout for my health',
        valueIds: [value.id],
      }),
    });
    expect(decisionResponse.statusCode).toBe(201);
    const decision = JSON.parse(decisionResponse.body).data;

    const alignmentResponse = await app.inject({
      method: 'GET',
      url: `/v1/values/decisions/${decision.id}/alignment`,
      headers: { authorization: `Bearer ${externalId}` },
    });
    expect(alignmentResponse.statusCode).toBe(200);
    const alignmentBody = JSON.parse(alignmentResponse.body);
    expect(alignmentBody.data.score).toBe(100);

    const outcomeResponse = await app.inject({
      method: 'POST',
      url: `/v1/values/decisions/${decision.id}/outcome`,
      headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ outcome: 'Felt energised all day', alignmentScore: 9, notes: '' }),
    });
    expect(outcomeResponse.statusCode).toBe(201);
    const outcome = JSON.parse(outcomeResponse.body).data;
    expect(outcome.alignmentScore).toBe(9);
  });
});
