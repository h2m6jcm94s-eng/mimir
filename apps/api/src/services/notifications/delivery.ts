import type { TenantContext } from '../../db/tenant-context';
import {
  type CreateNotificationInput,
  createNotification,
  findNotificationByDedupKey,
  updateDeliveryStatus,
} from '../../repositories/notification';
import { notificationsDeliveredCounter } from '../metrics/registry';

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function notify(ctx: TenantContext, input: CreateNotificationInput) {
  if (input.dedupKey) {
    const existing = await findNotificationByDedupKey(
      ctx,
      input.dedupKey,
      new Date(Date.now() - DEDUP_WINDOW_MS)
    );
    if (existing) {
      return { notification: existing, deliveries: [], deduplicated: true };
    }
  }

  const { notification, deliveries } = await createNotification(ctx, input);

  for (const delivery of deliveries) {
    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;
    try {
      await deliverChannel(ctx, notification, delivery);
      await updateDeliveryStatus(ctx, delivery.id, 'sent');
    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
      await updateDeliveryStatus(ctx, delivery.id, 'failed', errorMessage);
    }
    notificationsDeliveredCounter.inc({ channel: delivery.channel, status });
  }

  return { notification, deliveries, deduplicated: false };
}

async function deliverChannel(
  _ctx: TenantContext,
  notification: { title: string; body: string },
  delivery: { channel: string }
) {
  switch (delivery.channel) {
    case 'in_app':
      // In-app delivery is satisfied by the persisted row itself.
      return;
    case 'email':
      // Stub: wire real SMTP provider here.
      throw new Error('Email channel not yet configured');
    case 'slack':
      // Stub: wire Slack connector here.
      throw new Error('Slack channel not yet configured');
    case 'webhook':
      // Stub: wire outbound webhook dispatcher here.
      throw new Error('Webhook channel not yet configured');
    default:
      throw new Error(`Unknown channel: ${delivery.channel}`);
  }
}
