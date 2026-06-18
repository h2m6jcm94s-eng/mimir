import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * F-006 event bus end-to-end test.
 *
 * A real user would create a task and open the event timeline to watch progress.
 * We call the API as the UI would and verify that job lifecycle events are persisted
 * and returned by the events endpoint.
 */
test.describe('Task event timeline', () => {
  async function createTask(apiRequest: typeof test.request, idempotencyKey: string) {
    const response = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type: 'echo',
        prompt: 'e2e event timeline task',
        payload: {},
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).jobId as string;
  }

  async function pollJob(apiRequest: typeof test.request, jobId: string) {
    let status = 'queued';
    let body: Record<string, unknown> = {};
    for (let i = 0; i < 60; i++) {
      const getResponse = await apiRequest.get(`/v1/tasks/${jobId}`, {
        headers: apiRequestHeaders(),
      });
      expect(getResponse.status()).toBe(200);
      body = await getResponse.json();
      status = body.status as string;
      if (status === 'done' || status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return { status, body };
  }

  test('persists job lifecycle events across a task run', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-events-${Date.now()}`;
    const jobId = await createTask(apiRequest, idempotencyKey);

    const { status } = await pollJob(apiRequest, jobId);
    expect(status).toBe('done');

    const eventsResponse = await apiRequest.get(`/v1/tasks/${jobId}/events?limit=50`, {
      headers: apiRequestHeaders(),
    });
    expect(eventsResponse.status()).toBe(200);
    const eventsBody = await eventsResponse.json();
    expect(eventsBody.data).toBeInstanceOf(Array);

    const types = eventsBody.data.map((e: { type: string }) => e.type);
    expect(types).toContain('job.created');
    expect(types).toContain('job.queued');
    expect(types).toContain('job.running');
    expect(types).toContain('job.build.completed');
    expect(types).toContain('job.apply.completed');
    expect(types).toContain('job.done');

    for (const event of eventsBody.data) {
      expect(event).toMatchObject({
        id: expect.any(String),
        tenantId: expect.any(String),
        jobId,
        type: expect.any(String),
        payload: expect.any(Object),
        createdAt: expect.any(String),
      });
    }
  });
});
