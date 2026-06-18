import { z } from 'zod';

export const NotificationChannel = z.enum(['in_app', 'email', 'slack', 'webhook']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationStatus = z.enum(['pending', 'sent', 'failed']);
export type NotificationStatus = z.infer<typeof NotificationStatus>;

export const NotificationPriority = z.enum(['low', 'normal', 'high']);
export type NotificationPriority = z.infer<typeof NotificationPriority>;

export const NotificationDelivery = z.object({
  id: z.string().uuid(),
  notificationId: z.string().uuid(),
  channel: NotificationChannel,
  status: NotificationStatus,
  attempts: z.number().int().min(0),
  lastError: z.string().nullable(),
  externalId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NotificationDelivery = z.infer<typeof NotificationDelivery>;

export const Notification = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  priority: NotificationPriority,
  dedupKey: z.string().nullable(),
  payload: z.record(z.unknown()).nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Notification = z.infer<typeof Notification>;

export const CreateNotificationRequest = z.object({
  kind: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  priority: NotificationPriority.optional(),
  dedupKey: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  channels: z.array(NotificationChannel).default(['in_app']),
});
export type CreateNotificationRequest = z.infer<typeof CreateNotificationRequest>;

export const CreateNotificationResponse = z.object({
  notification: Notification,
  deliveries: z.array(NotificationDelivery),
  deduplicated: z.boolean(),
});
export type CreateNotificationResponse = z.infer<typeof CreateNotificationResponse>;

export const ListNotificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuery>;

export const ListNotificationsResponse = z.object({
  data: z.array(Notification),
});
export type ListNotificationsResponse = z.infer<typeof ListNotificationsResponse>;

export const NotificationUnreadCountResponse = z.object({
  count: z.number().int().min(0),
});
export type NotificationUnreadCountResponse = z.infer<typeof NotificationUnreadCountResponse>;
