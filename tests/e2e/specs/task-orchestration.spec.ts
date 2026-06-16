import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * M2-1 Temporal orchestration end-to-end test.
 *
 * A real user would click a button to start a task. Here we call the API directly
 * (as the UI would) and then poll the job record until the workflow finishes.
 *
 * Verifies:
 * - Task creation returns a job id and workflow id.
 * - The workflow runs build → review → apply.
 * - The job record ends in status "done" with checkpoint evidence.
 * - Idempotency: the same idempotency key returns the existing job.
 */
test.describe('Task orchestration', () => {
  test('runs a task through build, review, and apply', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-task-${Date.now()}`;

    const createResponse = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type: 'echo',
        prompt: 'say hello from e2e',
        payload: { message: 'hello from e2e' },
      },
    });

    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody).toMatchObject({
      jobId: expect.any(String),
      workflowId: expect.stringContaining(createBody.jobId),
      status: 'queued',
    });

    const jobId = createBody.jobId;

    // Poll until the workflow reaches a terminal state.
    let status = 'queued';
    let body: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) {
      const getResponse = await apiRequest.get(`/v1/tasks/${jobId}`, {
        headers: apiRequestHeaders(),
      });
      expect(getResponse.status()).toBe(200);
      body = await getResponse.json();
      status = body.status as string;
      if (status === 'done' || status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(status).toBe('done');
    expect(body.result).toMatchObject({ appliedAt: expect.any(String) });
    expect(body.checkpoint).toMatchObject({ apply: { result: { applied: true } } });
  });

  test('returns the existing job for a duplicate idempotency key', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-idempotent-${Date.now()}`;

    const first = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type: 'echo',
        prompt: 'do nothing',
        payload: {},
      },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type: 'echo',
        prompt: 'do nothing',
        payload: {},
      },
    });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.jobId).toBe(firstBody.jobId);
    expect(secondBody.idempotent).toBe(true);
  });
});
