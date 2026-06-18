import type { ApiClient } from '../client';

export async function showStatus(client: ApiClient) {
  const response = (await client.get('/healthz')) as Record<string, unknown>;
  console.log(JSON.stringify(response, null, 2));
}
