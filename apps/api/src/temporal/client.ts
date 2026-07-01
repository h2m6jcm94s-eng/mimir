import { randomUUID } from 'node:crypto';
import { Client, Connection, WorkflowNotFoundError } from '@temporalio/client';
import type { RoutineWorkflowInput, TaskRunInput } from './workflows';

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

export interface RoutineScheduleConfig {
  scheduleId: string;
  cron: string;
  input: RoutineWorkflowInput;
  paused?: boolean;
}

export async function createRoutineSchedule(config: RoutineScheduleConfig): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  await client.schedule.create({
    scheduleId: config.scheduleId,
    spec: {
      cronExpressions: [config.cron],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'routineWorkflow',
      args: [config.input],
      taskQueue,
    },
    state: { paused: config.paused },
  });
}

export async function updateRoutineSchedule(config: RoutineScheduleConfig): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const handle = client.schedule.getHandle(config.scheduleId);
  await handle.update((_) => ({
    spec: {
      cronExpressions: [config.cron],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'routineWorkflow',
      args: [config.input],
      taskQueue,
    },
    state: { paused: config.paused },
  }));
}

export async function deleteRoutineSchedule(scheduleId: string): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const handle = client.schedule.getHandle(scheduleId);
  await handle.delete();
}

export async function pauseRoutineSchedule(scheduleId: string): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const handle = client.schedule.getHandle(scheduleId);
  await handle.pause('Routine disabled');
}

export async function resumeRoutineSchedule(scheduleId: string): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const handle = client.schedule.getHandle(scheduleId);
  await handle.unpause('Routine enabled');
}

export async function triggerRoutineSchedule(scheduleId: string, input: RoutineWorkflowInput): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  await client.workflow.execute('routineWorkflow', {
    workflowId: `${scheduleId}-manual-${randomUUID()}`,
    taskQueue,
    args: [input],
  });
}

export interface DigestScheduleConfig {
  frequency: 'daily' | 'weekly';
  cron: string;
}

export async function ensureDigestSchedule(config: DigestScheduleConfig): Promise<void> {
  const conn = await getTemporalConnection();
  const client = new Client({ connection: conn });
  const scheduleId = `email-digest:${config.frequency}`;

  try {
    const handle = client.schedule.getHandle(scheduleId);
    await handle.update((_) => ({
      spec: { cronExpressions: [config.cron] },
      action: {
        type: 'startWorkflow',
        workflowType: 'digestWorkflow',
        args: [{ frequency: config.frequency }],
        taskQueue,
      },
      state: {},
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found') || message.includes('Schedule not found')) {
      await client.schedule.create({
        scheduleId,
        spec: { cronExpressions: [config.cron] },
        action: {
          type: 'startWorkflow',
          workflowType: 'digestWorkflow',
          args: [{ frequency: config.frequency }],
          taskQueue,
        },
      });
      return;
    }
    throw error;
  }
}
