import type { ApiClient } from '../client';

export async function listNodes(client: ApiClient) {
  const response = (await client.get('/v1/nodes')) as { data: Record<string, unknown>[] };
  console.table(
    response.data.map((node) => ({
      id: node.id,
      name: node.name,
      kind: node.kind,
      status: node.status,
      tier: node.tier,
      lastSeen: node.lastSeen,
    }))
  );
}

export async function heartbeatNode(client: ApiClient, nodeId: string, status: string) {
  const response = (await client.post(`/v1/nodes/${nodeId}/heartbeat`, { status })) as Record<
    string,
    unknown
  >;
  console.log(`Heartbeat acknowledged: ${response.status} at ${response.lastSeen}`);
}
