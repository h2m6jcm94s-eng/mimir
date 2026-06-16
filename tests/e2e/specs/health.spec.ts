import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Health endpoint smoke tests.
 *
 * These verify that the Fastify API is reachable and reports the status of its
 * dependencies (Postgres, Redis, Temporal) exactly as an operator would see it.
 */
test.describe('API health checks', () => {
  test('GET /livez returns alive', async ({ apiRequest }) => {
    const response = await apiRequest.get('/livez', {
      headers: apiRequestHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'alive' });
  });

  test('GET /readyz returns ready with dependency details', async ({ apiRequest }) => {
    const response = await apiRequest.get('/readyz', {
      headers: apiRequestHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'ready' });
    expect(body.dependencies).toBeDefined();
    expect(body.dependencies.postgres).toBe('ok');
    expect(body.dependencies.redis).toBe('ok');
    expect(body.dependencies.temporal).toBe('ok');
  });

  test('GET /healthz returns combined health', async ({ apiRequest }) => {
    const response = await apiRequest.get('/healthz', {
      headers: apiRequestHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'healthy' });
  });
});
