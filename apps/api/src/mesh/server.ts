import Fastify from 'fastify';
import type { MeshDiscovery } from './discovery';

export interface MeshServerOptions {
  port: number;
  nodeId: string;
  name: string;
  kind: 'brain' | 'desktop' | 'cloud' | 'phone';
  version?: string;
  discovery?: MeshDiscovery;
}

export async function startMeshServer(options: MeshServerOptions) {
  const app = Fastify({ logger: { level: 'warn' } });

  app.get('/mesh/info', async () => ({
    nodeId: options.nodeId,
    name: options.name,
    kind: options.kind,
    version: options.version ?? '1',
  }));

  app.get('/mesh/neighbors', async () => ({
    data: options.discovery?.getNeighbors() ?? [],
  }));

  app.get('/mesh/healthz', async () => ({ status: 'healthy' }));

  await app.listen({ port: options.port, host: '0.0.0.0' });
  return app;
}
