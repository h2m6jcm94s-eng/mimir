import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * F-005 LibSQL state store end-to-end test.
 *
 * A real operator would check /healthz and see LibSQL reported as healthy.
 * We verify the health endpoint includes a LibSQL dependency check.
 */
test.describe('LibSQL state store health', () => {
  test('reports libsql as a healthy dependency', async ({ apiRequest }) => {
    const response = await apiRequest.get('/healthz', {
      headers: apiRequestHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.dependencies).toHaveProperty('libsql', 'ok');
  });
});
