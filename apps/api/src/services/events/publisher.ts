import { JobEvent, type JobEventType } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import { getEventBus } from '../../event-bus';
import { type CreateJobEventInput, createJobEvent } from '../../repositories/event';

export interface PublishJobEventInput {
  jobId: string;
  type: JobEventType;
  payload?: Record<string, unknown>;
}

export async function publishJobEvent(ctx: TenantContext, input: PublishJobEventInput) {
  const persisted = await createJobEvent(ctx, {
    jobId: input.jobId,
    type: input.type as CreateJobEventInput['type'],
    payload: input.payload,
  });

  const event = JobEvent.parse({
    id: persisted.id,
    tenantId: persisted.tenantId,
    jobId: persisted.jobId,
    type: persisted.type,
    payload: persisted.payload,
    createdAt: persisted.createdAt.toISOString(),
  });

  try {
    await getEventBus().publish(event);
  } catch (err) {
    // The event is already persisted; the bus is best-effort for real-time subscribers.
    console.error('Failed to publish event to bus:', err);
  }

  return event;
}
