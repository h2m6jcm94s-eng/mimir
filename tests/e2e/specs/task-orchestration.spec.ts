import type { APIRequestContext } from '@playwright/test';
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
  async function createTask(
    apiRequest: APIRequestContext,
    idempotencyKey: string,
    type: string,
    prompt = 'e2e task'
  ) {
    const createResponse = await apiRequest.post('/v1/tasks', {
      headers: apiRequestHeaders(),
      data: {
        idempotencyKey,
        type,
        prompt,
        payload: {},
      },
    });

    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody).toMatchObject({
      jobId: expect.any(String),
      workflowId: expect.stringContaining(createBody.jobId),
      status: 'queued',
    });

    return createBody.jobId as string;
  }

  async function pollJob(apiRequest: APIRequestContext, jobId: string) {
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

  test('runs a task through build, review, and apply', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-task-${Date.now()}`;
    const jobId = await createTask(apiRequest, idempotencyKey, 'echo');
    const { status, body } = await pollJob(apiRequest, jobId);

    expect(status).toBe('done');
    expect(body.result).toMatchObject({ appliedAt: expect.any(String) });
    expect(body.checkpoint).toMatchObject({ apply: { result: { applied: true } } });
  });

  test('applies a reviewer patch and finishes within the loop', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-revise-${Date.now()}`;
    const jobId = await createTask(apiRequest, idempotencyKey, 'revise-once');
    const { status, body } = await pollJob(apiRequest, jobId);

    expect(status).toBe('done');
    expect(body.checkpoint).toMatchObject({
      patches: expect.any(Array),
      apply: { result: { applied: true } },
    });
    expect((body.checkpoint as Record<string, unknown>).patches).toHaveLength(1);
  });

  test('escalates when the review loop detects a cycle', async ({ apiRequest }) => {
    const idempotencyKey = `e2e-cycle-${Date.now()}`;
    const jobId = await createTask(apiRequest, idempotencyKey, 'cycle');
    const { status, body } = await pollJob(apiRequest, jobId);

    expect(['needs_attention', 'failed']).toContain(status);
    expect(body.checkpoint).toMatchObject({
      reviews: expect.any(Array),
      patches: expect.any(Array),
    });
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
