import { Client, Connection, WorkflowNotFoundError } from '@temporalio/client';
import type { TaskRunInput } from './workflows';

const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue';

let connection: Connection | undefined;

export async function getTemporalConnection(): Promise<Connection> {
  if (!connection) {
    connection = await Connection.connect({ address: temporalHost });
  }
  return connection;
}

export async function checkTemporal(): Promise<'ok' | 'error'> {
  try {
    const conn = await getTemporalConnection();
    await conn.workflowService.getSystemInfo({});
    return 'ok';
  } catch (err) {
    console.error('Temporal health check failed:', err);
    return 'error';
  }
}

export interface WorkflowStartResult {
  workflowId: string;
  runId: string;
}

export async function startTaskWorkflow(input: TaskRunInput): Promise<WorkflowStartResult> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const workflowId = `task-${input.jobId}`;

  const handle = await client.workflow.start('taskRunWorkflow', {
    taskQueue,
    workflowId,
    args: [input],
  });

  return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
}

export async function terminateWorkflow(workflowId: string): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });

  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.terminate('Cancelled by user');
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) return;
    throw error;
  }
}
