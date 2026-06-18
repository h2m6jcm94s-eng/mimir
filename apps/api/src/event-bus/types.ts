import type { JobEvent, JobEventType } from '@mimir/shared-types';

export type EventHandler = (event: JobEvent) => void | Promise<void>;

export interface EventBus {
  publish(event: JobEvent): Promise<void>;
  subscribe(topic: string, handler: EventHandler): Promise<() => void>;
  close?(): Promise<void>;
}

export function jobEventTopic(tenantId: string, jobId: string): string {
  return `tenant:${tenantId}:job:${jobId}`;
}

export function jobEventBroadcastTopic(tenantId: string): string {
  return `tenant:${tenantId}:jobs`;
}

export function isJobEventType(value: string): value is JobEventType {
  const valid: readonly string[] = [
    'job.created',
    'job.queued',
    'job.blocked',
    'job.running',
    'job.build.completed',
    'job.review.completed',
    'job.patch.applied',
    'job.apply.completed',
    'job.apply.failed',
    'job.done',
    'job.failed',
    'job.cancelled',
    'job.retried',
    'job.status_updated',
    'job.approval.requested',
  ];
  return valid.includes(value);
}
