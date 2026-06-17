import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { upsertBudget } from '../repositories/budget';
import { buildTestApp } from '../test-helpers/build-app';
import { budgetRoutes } from './budget';

const MICROS_PER_DOLLAR = 1_000_000;

describe('budget routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(budgetRoutes, { prefix: '/v1/budget' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/budget',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns default status before budget is set', async () => {
    const token = `budget_default_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(budgetRoutes, { prefix: '/v1/budget' });
    });

    await resolveAuthUser(token, `${token}@test.local`);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/budget',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.enabled).toBe(false);
    expect(body.data.dailyBudgetUsd).toBe(0);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('saves and returns budget settings', async () => {
    const token = `budget_save_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(budgetRoutes, { prefix: '/v1/budget' });
    });

    const user = await resolveAuthUser(token, `${token}@test.local`);

    const putResponse = await app.inject({
      method: 'PUT',
      url: '/v1/budget',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dailyBudgetUsd: 50 * MICROS_PER_DOLLAR,
        monthlyBudgetUsd: 500 * MICROS_PER_DOLLAR,
        throttleThreshold: 0.75,
      },
    });

    expect(putResponse.statusCode).toBe(200);
    const putBody = JSON.parse(putResponse.body);
    expect(putBody.data.dailyBudgetUsd).toBe(50 * MICROS_PER_DOLLAR);

    const getResponse = await app.inject({
      method: 'GET',
      url: '/v1/budget',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getResponse.statusCode).toBe(200);
    const getBody = JSON.parse(getResponse.body);
    expect(getBody.data.dailyBudgetUsd).toBe(50 * MICROS_PER_DOLLAR);
    expect(getBody.data.monthlyBudgetUsd).toBe(500 * MICROS_PER_DOLLAR);

    const forecastResponse = await app.inject({
      method: 'GET',
      url: '/v1/budget/forecast',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(forecastResponse.statusCode).toBe(200);
    const forecastBody = JSON.parse(forecastResponse.body);
    expect(typeof forecastBody.data.projectedEndOfDayUsd).toBe('number');

    await withTenantTransaction(user.tenantId, async (ctx) => {
      const budget = await upsertBudget(ctx, { enabled: false });
      expect(budget.enabled).toBe(false);
    });
  });
});
