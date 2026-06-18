import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { memoryRoutes } from './memory';

describe('memory routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(memoryRoutes, { prefix: '/v1/memory' });
    });

    const response = await app.inject({ method: 'GET', url: '/v1/memory/graph' });
    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('creates nodes and edges and reads the graph', async () => {
    const token = `memory_graph_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(memoryRoutes, { prefix: '/v1/memory' });
    });
    await resolveAuthUser(token, `${token}@test.local`);

    const nodeA = await app.inject({
      method: 'POST',
      url: '/v1/memory/nodes',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'semantic', key: 'person.alice', value: { name: 'Alice' } },
    });
    expect(nodeA.statusCode).toBe(201);
    const nodeAId = JSON.parse(nodeA.body).data.id;

    const nodeB = await app.inject({
      method: 'POST',
      url: '/v1/memory/nodes',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'semantic', key: 'person.bob', value: { name: 'Bob' } },
    });
    const nodeBId = JSON.parse(nodeB.body).data.id;

    const edge = await app.inject({
      method: 'POST',
      url: '/v1/memory/edges',
      headers: { authorization: `Bearer ${token}` },
      payload: { sourceId: nodeAId, targetId: nodeBId, rel: 'knows', weight: 0.8 },
    });
    expect(edge.statusCode).toBe(201);

    const graph = await app.inject({
      method: 'GET',
      url: '/v1/memory/graph',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(graph.statusCode).toBe(200);
    const graphBody = JSON.parse(graph.body);
    expect(graphBody.data.nodes).toHaveLength(2);
    expect(graphBody.data.edges).toHaveLength(1);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates checkpoints, diffs, restores, and branches',
    async () => {
      const token = `memory_tm_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(memoryRoutes, { prefix: '/v1/memory' });
      });
      await resolveAuthUser(token, `${token}@test.local`);

      const nodeA = await app.inject({
        method: 'POST',
        url: '/v1/memory/nodes',
        headers: { authorization: `Bearer ${token}` },
        payload: { kind: 'semantic', key: 'fact.v1', value: { text: 'hello' } },
      });
      const nodeAId = JSON.parse(nodeA.body).data.id;

      const cp1 = await app.inject({
        method: 'POST',
        url: '/v1/memory/checkpoints',
        headers: { authorization: `Bearer ${token}` },
        payload: { label: 'v1' },
      });
      expect(cp1.statusCode).toBe(201);

      await app.inject({
        method: 'PATCH',
        url: `/v1/memory/nodes/${nodeAId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { value: { text: 'world' } },
      });

      const cp2 = await app.inject({
        method: 'POST',
        url: '/v1/memory/checkpoints',
        headers: { authorization: `Bearer ${token}` },
        payload: { label: 'v2' },
      });
      const cp2Id = JSON.parse(cp2.body).data.id;

      const diff = await app.inject({
        method: 'GET',
        url: `/v1/memory/checkpoints/${cp2Id}/diff`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(diff.statusCode).toBe(200);
      const diffBody = JSON.parse(diff.body);
      expect(diffBody.data.changedNodes).toHaveLength(1);

      const restore = await app.inject({
        method: 'POST',
        url: `/v1/memory/checkpoints/${JSON.parse(cp1.body).data.id}/restore`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(restore.statusCode).toBe(200);

      const graph = await app.inject({
        method: 'GET',
        url: '/v1/memory/graph',
        headers: { authorization: `Bearer ${token}` },
      });
      const graphBody = JSON.parse(graph.body);
      expect(graphBody.data.nodes[0].value.text).toBe('hello');

      const branch = await app.inject({
        method: 'POST',
        url: '/v1/memory/branch',
        headers: { authorization: `Bearer ${token}` },
        payload: { fromCheckpointId: JSON.parse(cp1.body).data.id, label: 'experiment' },
      });
      expect(branch.statusCode).toBe(201);
    }
  );
});
