import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface UpsertEmailDigestPreferenceInput {
  appUserId: string;
  frequency: (typeof schema.emailDigestFrequencyEnum.enumValues)[number];
  enabled: boolean;
  includeNotifications: boolean;
  includeTasks: boolean;
  includeApprovals: boolean;
  includeReports: boolean;
}

export async function getEmailDigestPreference(ctx: TenantContext, appUserId: string) {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.emailDigestPreference)
    .where(
      and(
        eq(schema.emailDigestPreference.tenantId, ctx.tenantId),
        eq(schema.emailDigestPreference.appUserId, appUserId)
      )
    );
  return row;
}

export async function upsertEmailDigestPreference(
  ctx: TenantContext,
  input: UpsertEmailDigestPreferenceInput
) {
  const existing = await getEmailDigestPreference(ctx, input.appUserId);
  if (existing) {
    const [updated] = await ctx.tenantScopedDb
      .update(schema.emailDigestPreference)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(schema.emailDigestPreference.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await ctx.tenantScopedDb
    .insert(schema.emailDigestPreference)
    .values({
      tenantId: ctx.tenantId,
      ...input,
    })
    .returning();
  return created;
}

export async function listDueEmailDigestPreferences(
  ctx: TenantContext,
  frequency: (typeof schema.emailDigestFrequencyEnum.enumValues)[number],
  since: Date
) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.emailDigestPreference)
    .where(
      and(
        eq(schema.emailDigestPreference.tenantId, ctx.tenantId),
        eq(schema.emailDigestPreference.enabled, true),
        eq(schema.emailDigestPreference.frequency, frequency),
        sql`${schema.emailDigestPreference.lastSentAt} IS NULL OR ${schema.emailDigestPreference.lastSentAt} < ${since}`
      )
    );
}

export async function markEmailDigestSent(ctx: TenantContext, id: string) {
  const [updated] = await ctx.tenantScopedDb
    .update(schema.emailDigestPreference)
    .set({ lastSentAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.emailDigestPreference.id, id))
    .returning();
  return updated;
}
