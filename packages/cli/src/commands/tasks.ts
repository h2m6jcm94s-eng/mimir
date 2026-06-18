import type { ApiClient } from '../client';

export async function listTasks(
  client: ApiClient,
  options: { status?: string; type?: string; limit?: string }
) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.type) params.set('type', options.type);
  if (options.limit) params.set('limit', options.limit);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = (await client.get(`/v1/tasks${query}`)) as { data: Record<string, unknown>[] };
  console.table(
    response.data.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      tier: job.tier,
      cost: job.costUsd,
      created: job.createdAt,
    }))
  );
}

export async function getTask(client: ApiClient, jobId: string) {
  const response = (await client.get(`/v1/tasks/${jobId}`)) as Record<string, unknown>;
  console.log(JSON.stringify(response, null, 2));
}

export async function createTask(
  client: ApiClient,
  options: { type: string; prompt: string; provider?: string; model?: string }
) {
  const idempotencyKey = `cli-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = (await client.post('/v1/tasks', {
    idempotencyKey,
    type: options.type,
    prompt: options.prompt,
    payload: {},
    ...(options.provider && { provider: options.provider }),
    ...(options.model && { model: options.model }),
  })) as { jobId: string; status: string };
  console.log(`Created task ${response.jobId} (${response.status})`);
}
