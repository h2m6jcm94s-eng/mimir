import { and, desc, eq, gte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateNotificationInput {
  kind: string;
  title: string;
  body: string;
  priority?: (typeof schema.notification.$inferInsert)['priority'];
  dedupKey?: string;
  payload?: Record<string, unknown>;
  channels: (typeof schema.notificationDelivery.$inferInsert)['channel'][];
}

export async function findNotificationByDedupKey(
  ctx: TenantContext,
  dedupKey: string,
  since: Date
) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.notification)
    .where(
      and(eq(schema.notification.dedupKey, dedupKey), gte(schema.notification.createdAt, since))
    )
    .limit(1);
  return found;
}

export async function createNotification(ctx: TenantContext, input: CreateNotificationInput) {
  const [notification] = await ctx.tenantScopedDb
    .insert(schema.notification)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      priority: input.priority ?? 'normal',
      dedupKey: input.dedupKey,
      payload: input.payload,
    })
    .returning();

  const deliveries = await Promise.all(
    input.channels.map(async (channel) => {
      const [delivery] = await ctx.tenantScopedDb
        .insert(schema.notificationDelivery)
        .values({
          tenantId: ctx.tenantId,
          notificationId: notification.id,
          channel,
        })
        .returning();
      return delivery;
    })
  );

  return { notification, deliveries };
}

export async function listNotifications(ctx: TenantContext, limit: number) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.notification)
    .orderBy(desc(schema.notification.createdAt))
    .limit(limit);
}

export async function getNotification(ctx: TenantContext, id: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.notification)
    .where(eq(schema.notification.id, id));
  return found;
}

export async function markNotificationRead(ctx: TenantContext, id: string) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.notification)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.notification.id, id))
    .returning();
  return updated;
}

export async function updateDeliveryStatus(
  ctx: TenantContext,
  deliveryId: string,
  status: (typeof schema.notificationDelivery.$inferInsert)['status'],
  error?: string,
  externalId?: string
) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.notificationDelivery)
    .set({
      status,
      attempts: sql`${schema.notificationDelivery.attempts} + 1`,
      lastError: error ?? null,
      externalId: externalId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.notificationDelivery.id, deliveryId))
    .returning();
  return updated;
}

export async function listDeliveriesForNotification(ctx: TenantContext, notificationId: string) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.notificationDelivery)
    .where(eq(schema.notificationDelivery.notificationId, notificationId));
}
