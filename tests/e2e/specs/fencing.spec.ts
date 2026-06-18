import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * F-011 leader/fencing end-to-end test.
 *
 * A real user would trigger a leader hand-off (promotion) in the mesh. The
 * fencing endpoint bumps the tenant's epoch; writes that still carry the old
 * epoch are rejected so stale leaders transition to read-only.
 */
test.describe('Leader/fencing', () => {
  async function createTask(apiRequest: typeof test.request, idempotencyKey: string) {
    const response = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type: 'echo',
        prompt: 'e2e fencing task',
        payload: {},
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).jobId as string;
  }

  test('reads and bumps the fencing epoch', async ({ apiRequest }) => {
    const readResponse = await apiRequest.get('/v1/fencing/epoch', {
      headers: apiRequestHeaders(),
    });
    expect(readResponse.status()).toBe(200);
    const before = (await readResponse.json()) as { epoch: number };
    expect(typeof before.epoch).toBe('number');

    const bumpResponse = await apiRequest.post('/v1/fencing/epoch/bump', {
      headers: apiRequestHeaders(),
      data: {},
    });
    expect(bumpResponse.status()).toBe(200);
    const after = (await bumpResponse.json()) as { epoch: number };
    expect(after.epoch).toBe(before.epoch + 1);
  });

  test('rejects stale-epoch writes after promotion', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-fencing-${Date.now()}`;
    const jobId = await createTask(apiRequest, idempotencyKey);

    const epochResponse = await apiRequest.get('/v1/fencing/epoch', {
      headers: apiRequestHeaders(),
    });
    expect(epochResponse.status()).toBe(200);
    const { epoch } = (await epochResponse.json()) as { epoch: number };

    const bumpResponse = await apiRequest.post('/v1/fencing/epoch/bump', {
      headers: apiRequestHeaders(),
      data: {},
    });
    expect(bumpResponse.status()).toBe(200);

    const patchResponse = await apiRequest.patch(`/v1/tasks/${jobId}/status`, {
      headers: apiRequestHeaders(),
      data: { status: 'blocked', epoch },
    });
    expect(patchResponse.status()).toBe(409);
    const body = (await patchResponse.json()) as { error: { code: string } };
    expect(body.error.code).toBe('STALE_EPOCH');
  });
});
