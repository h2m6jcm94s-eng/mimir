import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateBrandVoiceInput {
  name: string;
  tone?: string;
  audience?: string;
  guidelines?: string;
  sampleText?: string;
  isDefault?: boolean;
}

export interface UpdateBrandVoiceInput {
  name?: string;
  tone?: string;
  audience?: string;
  guidelines?: string;
  sampleText?: string;
  isDefault?: boolean;
}

export interface CreateCampaignInput {
  brandVoiceId?: string;
  name: string;
  goal?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  metrics?: Record<string, unknown>;
}

export interface UpdateCampaignInput {
  brandVoiceId?: string | null;
  name?: string;
  goal?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  metrics?: Record<string, unknown>;
}

export interface CreateCalendarItemInput {
  campaignId?: string;
  title: string;
  body?: string;
  platform: string;
  scheduledAt?: string;
  status?: string;
  tier?: number;
}

export interface UpdateCalendarItemInput {
  campaignId?: string | null;
  title?: string;
  body?: string;
  platform?: string;
  scheduledAt?: string | null;
  status?: string;
  tier?: number;
}

export interface ListCalendarOptions {
  campaignId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit: number;
}

export async function createBrandVoice(
  ctx: TenantContext,
  input: CreateBrandVoiceInput
): Promise<typeof schema.brandVoice.$inferSelect> {
  if (input.isDefault) {
    await ctx.tenantScopedDb
      .update(schema.brandVoice)
      .set({ isDefault: false })
      .where(eq(schema.brandVoice.tenantId, ctx.tenantId));
  }
  const [row] = await ctx.tenantScopedDb
    .insert(schema.brandVoice)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      tone: input.tone ?? '',
      audience: input.audience ?? '',
      guidelines: input.guidelines ?? '',
      sampleText: input.sampleText ?? '',
      isDefault: input.isDefault ?? false,
    })
    .returning();
  return row;
}

export async function listBrandVoices(
  ctx: TenantContext,
  limit: number
): Promise<(typeof schema.brandVoice.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.brandVoice)
    .where(eq(schema.brandVoice.tenantId, ctx.tenantId))
    .orderBy(desc(schema.brandVoice.isDefault), asc(schema.brandVoice.name))
    .limit(limit);
}

export async function getBrandVoiceById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.brandVoice.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.brandVoice)
    .where(and(eq(schema.brandVoice.id, id), eq(schema.brandVoice.tenantId, ctx.tenantId)));
  return row;
}

export async function updateBrandVoice(
  ctx: TenantContext,
  id: string,
  input: UpdateBrandVoiceInput
): Promise<typeof schema.brandVoice.$inferSelect | undefined> {
  if (input.isDefault) {
    await ctx.tenantScopedDb
      .update(schema.brandVoice)
      .set({ isDefault: false })
      .where(eq(schema.brandVoice.tenantId, ctx.tenantId));
  }
  const [row] = await ctx.tenantScopedDb
    .update(schema.brandVoice)
    .set({
      ...input,
      updatedAt: sql`now()`,
    })
    .where(and(eq(schema.brandVoice.id, id), eq(schema.brandVoice.tenantId, ctx.tenantId)))
    .returning();
  return row;
}

export async function deleteBrandVoice(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.brandVoice)
    .where(and(eq(schema.brandVoice.id, id), eq(schema.brandVoice.tenantId, ctx.tenantId)))
    .returning();
  return result.length > 0;
}

export async function createCampaign(
  ctx: TenantContext,
  input: CreateCampaignInput
): Promise<typeof schema.campaign.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.campaign)
    .values({
      tenantId: ctx.tenantId,
      brandVoiceId: input.brandVoiceId,
      name: input.name,
      goal: input.goal ?? '',
      status: input.status as (typeof schema.marketingCampaignStatusEnum.enumValues)[number],
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      budget: input.budget ?? null,
      metrics: input.metrics ?? {},
    })
    .returning();
  return row;
}

export async function listCampaigns(
  ctx: TenantContext,
  options: { status?: string; limit: number }
): Promise<(typeof schema.campaign.$inferSelect)[]> {
  const conditions = [eq(schema.campaign.tenantId, ctx.tenantId)];
  if (options.status) {
    conditions.push(
      eq(
        schema.campaign.status,
        options.status as (typeof schema.marketingCampaignStatusEnum.enumValues)[number]
      )
    );
  }
  return ctx.tenantScopedDb
    .select()
    .from(schema.campaign)
    .where(and(...conditions))
    .orderBy(desc(schema.campaign.createdAt))
    .limit(options.limit);
}

export async function getCampaignById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.campaign.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.campaign)
    .where(and(eq(schema.campaign.id, id), eq(schema.campaign.tenantId, ctx.tenantId)));
  return row;
}

export async function updateCampaign(
  ctx: TenantContext,
  id: string,
  input: UpdateCampaignInput
): Promise<typeof schema.campaign.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.campaign)
    .set({
      ...(input.brandVoiceId !== undefined ? { brandVoiceId: input.brandVoiceId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status as (typeof schema.marketingCampaignStatusEnum.enumValues)[number],
          }
        : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.endDate !== undefined
        ? { endDate: input.endDate ? new Date(input.endDate) : null }
        : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.metrics !== undefined ? { metrics: input.metrics } : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(schema.campaign.id, id), eq(schema.campaign.tenantId, ctx.tenantId)))
    .returning();
  return row;
}

export async function deleteCampaign(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.campaign)
    .where(and(eq(schema.campaign.id, id), eq(schema.campaign.tenantId, ctx.tenantId)))
    .returning();
  return result.length > 0;
}

export async function createCalendarItem(
  ctx: TenantContext,
  input: CreateCalendarItemInput
): Promise<typeof schema.contentCalendarItem.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.contentCalendarItem)
    .values({
      tenantId: ctx.tenantId,
      campaignId: input.campaignId,
      title: input.title,
      body: input.body ?? '',
      platform: input.platform as (typeof schema.marketingPlatformEnum.enumValues)[number],
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      status: input.status as (typeof schema.marketingCalendarStatusEnum.enumValues)[number],
      tier: input.tier ?? 1,
    })
    .returning();
  return row;
}

export async function listCalendarItems(
  ctx: TenantContext,
  options: ListCalendarOptions
): Promise<(typeof schema.contentCalendarItem.$inferSelect)[]> {
  const conditions = [eq(schema.contentCalendarItem.tenantId, ctx.tenantId)];
  if (options.campaignId) {
    conditions.push(eq(schema.contentCalendarItem.campaignId, options.campaignId));
  }
  if (options.status) {
    conditions.push(
      eq(
        schema.contentCalendarItem.status,
        options.status as (typeof schema.marketingCalendarStatusEnum.enumValues)[number]
      )
    );
  }
  if (options.from) {
    conditions.push(gte(schema.contentCalendarItem.scheduledAt, new Date(options.from)));
  }
  if (options.to) {
    conditions.push(lte(schema.contentCalendarItem.scheduledAt, new Date(options.to)));
  }
  return ctx.tenantScopedDb
    .select()
    .from(schema.contentCalendarItem)
    .where(and(...conditions))
    .orderBy(
      asc(schema.contentCalendarItem.scheduledAt),
      desc(schema.contentCalendarItem.createdAt)
    )
    .limit(options.limit);
}

export async function getCalendarItemById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.contentCalendarItem.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.contentCalendarItem)
    .where(
      and(
        eq(schema.contentCalendarItem.id, id),
        eq(schema.contentCalendarItem.tenantId, ctx.tenantId)
      )
    );
  return row;
}

export async function updateCalendarItem(
  ctx: TenantContext,
  id: string,
  input: UpdateCalendarItemInput
): Promise<typeof schema.contentCalendarItem.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.contentCalendarItem)
    .set({
      ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.platform !== undefined
        ? {
            platform: input.platform as (typeof schema.marketingPlatformEnum.enumValues)[number],
          }
        : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
        : {}),
      ...(input.status !== undefined
        ? {
            status: input.status as (typeof schema.marketingCalendarStatusEnum.enumValues)[number],
          }
        : {}),
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(schema.contentCalendarItem.id, id),
        eq(schema.contentCalendarItem.tenantId, ctx.tenantId)
      )
    )
    .returning();
  return row;
}

export async function deleteCalendarItem(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.contentCalendarItem)
    .where(
      and(
        eq(schema.contentCalendarItem.id, id),
        eq(schema.contentCalendarItem.tenantId, ctx.tenantId)
      )
    )
    .returning();
  return result.length > 0;
}

export async function getMarketingAnalytics(ctx: TenantContext): Promise<{
  campaigns: { total: number; active: number; completed: number };
  calendar: { total: number; scheduled: number; published: number };
  totals: { impressions: number; clicks: number; conversions: number };
}> {
  const campaigns = await ctx.tenantScopedDb
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      active: sql<number>`count(*) FILTER (WHERE ${schema.campaign.status} = 'active')`.mapWith(
        Number
      ),
      completed:
        sql<number>`count(*) FILTER (WHERE ${schema.campaign.status} = 'completed')`.mapWith(
          Number
        ),
    })
    .from(schema.campaign)
    .where(eq(schema.campaign.tenantId, ctx.tenantId));

  const calendar = await ctx.tenantScopedDb
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      scheduled:
        sql<number>`count(*) FILTER (WHERE ${schema.contentCalendarItem.status} = 'scheduled')`.mapWith(
          Number
        ),
      published:
        sql<number>`count(*) FILTER (WHERE ${schema.contentCalendarItem.status} = 'published')`.mapWith(
          Number
        ),
    })
    .from(schema.contentCalendarItem)
    .where(eq(schema.contentCalendarItem.tenantId, ctx.tenantId));

  const metricsRows = await ctx.tenantScopedDb
    .select({ metrics: schema.campaign.metrics })
    .from(schema.campaign)
    .where(eq(schema.campaign.tenantId, ctx.tenantId));

  const totals = metricsRows.reduce(
    (acc, row) => {
      const m = (row.metrics as Record<string, number>) ?? {};
      return {
        impressions: acc.impressions + (m.impressions ?? 0),
        clicks: acc.clicks + (m.clicks ?? 0),
        conversions: acc.conversions + (m.conversions ?? 0),
      };
    },
    { impressions: 0, clicks: 0, conversions: 0 }
  );

  return {
    campaigns: campaigns[0] ?? { total: 0, active: 0, completed: 0 },
    calendar: calendar[0] ?? { total: 0, scheduled: 0, published: 0 },
    totals,
  };
}

export async function getDefaultBrandVoice(
  ctx: TenantContext
): Promise<typeof schema.brandVoice.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.brandVoice)
    .where(and(eq(schema.brandVoice.tenantId, ctx.tenantId), eq(schema.brandVoice.isDefault, true)))
    .limit(1);
  return row;
}
