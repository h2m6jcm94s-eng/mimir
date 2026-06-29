import { JobEvent, type JobEventType } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import { getEventBus } from '../../event-bus';
import { type CreateJobEventInput, createJobEvent } from '../../repositories/event';
import { notify } from '../notifications/delivery';
import { scheduleSync } from '../state/sync';

export interface PublishJobEventInput {
  jobId: string;
  type: JobEventType;
  payload?: Record<string, unknown>;
}

const NOTIFY_EVENT_TYPES: JobEventType[] = [
  'job.approval.requested',
  'job.failed',
  'job.done',
  'cloud_worker.returned',
];

function notificationForEvent(input: PublishJobEventInput): {
  kind: string;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high';
  dedupKey: string;
} | null {
  const jobId = input.jobId.slice(0, 8);
  switch (input.type) {
    case 'job.approval.requested':
      return {
        kind: 'approval.requested',
        title: 'Approval requested',
        body: `Task ${jobId} is waiting for your approval before it can continue.`,
        priority: 'high',
        dedupKey: `approval:${input.jobId}`,
      };
    case 'job.failed':
      return {
        kind: 'job.failed',
        title: 'Task failed',
        body: `Task ${jobId} failed and may need attention.`,
        priority: 'high',
        dedupKey: `failed:${input.jobId}`,
      };
    case 'job.done':
      return {
        kind: 'job.done',
        title: 'Task completed',
        body: `Task ${jobId} finished successfully.`,
        priority: 'normal',
        dedupKey: `done:${input.jobId}`,
      };
    case 'cloud_worker.returned':
      return {
        kind: 'cloud_worker.returned',
        title: 'Cloud worker returned',
        body: `A cloud worker job returned results for task ${jobId}.`,
        priority: 'normal',
        dedupKey: `cloud:${input.jobId}`,
      };
    default:
      return null;
  }
}

export async function publishJobEvent(ctx: TenantContext, input: PublishJobEventInput) {
  const persisted = await createJobEvent(ctx, {
    jobId: input.jobId,
    type: input.type as CreateJobEventInput['type'],
    payload: input.payload,
  });

  // Replicate the updated state to the local LibSQL replica asynchronously.
  scheduleSync(ctx.tenantId);

  const event = JobEvent.parse({
    id: persisted.id,
    tenantId: persisted.tenantId,
    jobId: persisted.jobId,
    type: persisted.type,
    payload: persisted.payload,
    createdAt: persisted.createdAt.toISOString(),
  });

  if (NOTIFY_EVENT_TYPES.includes(input.type)) {
    const n = notificationForEvent(input);
    if (n) {
      try {
        await notify(ctx, {
          kind: n.kind,
          title: n.title,
          body: n.body,
          priority: n.priority,
          dedupKey: n.dedupKey,
          payload: input.payload,
          channels: ['in_app'],
        });
      } catch (err) {
        // Notification creation is best-effort; the event itself is already persisted.
        console.error('Failed to create notification for job event:', err);
      }
    }
  }

  try {
    await getEventBus().publish(event);
  } catch (err) {
    // The event is already persisted; the bus is best-effort for real-time subscribers.
    console.error('Failed to publish event to bus:', err);
  }

  return event;
}
