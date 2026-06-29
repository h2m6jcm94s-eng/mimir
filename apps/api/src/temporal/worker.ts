import http from 'node:http';
import path from 'node:path';
import { NativeConnection, Worker, bundleWorkflowCode } from '@temporalio/worker';
import { resolveDeploymentSecrets } from '../services/secrets/bootstrap';
import { initializeLibSqlSchema } from '../services/state/libsql-schema';
import * as activities from './activities';

const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue';
const healthPort = Number(process.env.WORKER_HEALTH_PORT) || 3002;

async function run() {
  // Load deployment secrets before any activity can use them.
  await resolveDeploymentSecrets();

  // Ensure the local LibSQL replica schema is ready before activities run.
  await initializeLibSqlSchema();

  const connection = await NativeConnection.connect({ address: temporalHost });

  const workflowBundle = await bundleWorkflowCode({
    workflowsPath: path.join(__dirname, 'workflows.ts'),
  });

  const worker = await Worker.create({
    workflowBundle,
    activities,
    taskQueue,
    connection,
  });

  // Expose a minimal readiness probe so orchestrators (Playwright, Docker,
  // k8s) can wait until the worker is initialized before starting tests.
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/readyz') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ready' }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  healthServer.listen(healthPort, () => {
    console.log(`Worker health probe on http://localhost:${healthPort}/readyz`);
  });

  console.log(`Temporal worker listening on ${temporalHost} / ${taskQueue}`);
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
