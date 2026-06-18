import { MeshDiscovery, generateMeshNodeId } from './discovery';
import { startMeshServer } from './server';

async function main() {
  const port = Number(process.env.MESH_SERVER_PORT) || 3003;
  const nodeId = process.env.MESH_NODE_ID || generateMeshNodeId();
  const name = process.env.MESH_NODE_NAME || 'mimir-node';
  const kind = (process.env.MESH_NODE_KIND as 'brain' | 'desktop' | 'cloud' | 'phone') || 'brain';

  const discovery = new MeshDiscovery({
    nodeId,
    name,
    kind,
    meshServerPort: port,
  });

  await discovery.start();
  const app = await startMeshServer({ port, nodeId, name, kind, discovery });

  app.log.info(`Mesh server listening on ${port} (node ${nodeId})`);

  process.on('SIGTERM', async () => {
    await discovery.stop();
    await app.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
