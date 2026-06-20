import {
  createRoutineSchedule,
  deleteRoutineSchedule,
  pauseRoutineSchedule,
  resumeRoutineSchedule,
  triggerRoutineSchedule,
  updateRoutineSchedule,
} from '../../temporal/client';
import type { RoutineWorkflowInput } from '../../temporal/workflows';

export type RoutineScheduleInput = {
  tenantId: string;
  userId: string;
  routineId: string;
  cron: string;
  jobType: string;
  tier: number;
  payload: Record<string, unknown>;
  enabled: boolean;
};

function scheduleId(tenantId: string, routineId: string): string {
  return `routine:${tenantId}:${routineId}`;
}

function buildInput(input: RoutineScheduleInput): RoutineWorkflowInput {
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    routineId: input.routineId,
    runId: crypto.randomUUID(),
    jobType: input.jobType,
    tier: input.tier,
    payload: input.payload,
  };
}

export async function scheduleRoutine(input: RoutineScheduleInput): Promise<void> {
  if (!input.cron) return;
  await createRoutineSchedule({
    scheduleId: scheduleId(input.tenantId, input.routineId),
    cron: input.cron,
    input: buildInput(input),
    paused: !input.enabled,
  });
}

export async function updateScheduledRoutine(input: RoutineScheduleInput): Promise<void> {
  if (!input.cron) return;
  const id = scheduleId(input.tenantId, input.routineId);
  try {
    await updateRoutineSchedule({
      scheduleId: id,
      cron: input.cron,
      input: buildInput(input),
      paused: !input.enabled,
    });
  } catch (error) {
    // If the schedule doesn't exist yet (e.g. created before scheduler existed),
    // create it.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found') || message.includes('Schedule not found')) {
      await scheduleRoutine(input);
      return;
    }
    throw error;
  }
}

export async function deleteScheduledRoutine(tenantId: string, routineId: string): Promise<void> {
  try {
    await deleteRoutineSchedule(scheduleId(tenantId, routineId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found') || message.includes('Schedule not found')) {
      return;
    }
    throw error;
  }
}

export async function setRoutineSchedulePaused(
  tenantId: string,
  routineId: string,
  paused: boolean
): Promise<void> {
  const id = scheduleId(tenantId, routineId);
  try {
    if (paused) {
      await pauseRoutineSchedule(id);
    } else {
      await resumeRoutineSchedule(id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found') || message.includes('Schedule not found')) {
      return;
    }
    throw error;
  }
}

export async function triggerRoutine(
  tenantId: string,
  userId: string,
  routineId: string,
  runId: string,
  routine: {
    jobType: string;
    tier: number;
    jobInput: Record<string, unknown>;
  }
): Promise<void> {
  const id = scheduleId(tenantId, routineId);
  const input: RoutineWorkflowInput = {
    tenantId,
    userId,
    routineId,
    runId,
    jobType: routine.jobType,
    tier: routine.tier,
    payload: routine.jobInput,
  };
  await triggerRoutineSchedule(id, input);
}
