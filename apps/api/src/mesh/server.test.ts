import { describe, expect, it } from 'vitest';
import { startMeshServer } from './server';

describe('mesh server', () => {
  it('exposes node info and health endpoints', async () => {
    const app = await startMeshServer({
      port: 0,
      nodeId: 'node-1',
      name: 'test-brain',
      kind: 'brain',
      version: '1.0.0',
    });

    const info = await app.inject({ method: 'GET', url: '/mesh/info' });
    expect(info.statusCode).toBe(200);
    expect(JSON.parse(info.body)).toEqual({
      nodeId: 'node-1',
      name: 'test-brain',
      kind: 'brain',
      version: '1.0.0',
    });

    const health = await app.inject({ method: 'GET', url: '/mesh/healthz' });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ status: 'healthy' });

    await app.close();
  });

  it('returns an empty neighbor list when no discovery is wired', async () => {
    const app = await startMeshServer({
      port: 0,
      nodeId: 'node-1',
      name: 'test-brain',
      kind: 'brain',
    });

    const neighbors = await app.inject({ method: 'GET', url: '/mesh/neighbors' });
    expect(neighbors.statusCode).toBe(200);
    expect(JSON.parse(neighbors.body)).toEqual({ data: [] });

    await app.close();
  });
});
