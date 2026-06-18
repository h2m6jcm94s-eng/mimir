import { and, asc, eq, lte } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type LifeAdminRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type LifeAdminStatus = 'pending' | 'done';

export interface CreateLifeAdminInput {
  title: string;
  description: string;
  dueDate: string;
  recurrence: LifeAdminRecurrence;
  category?: string;
  tags?: string[];
  tier?: number;
}

export interface LifeAdminListOptions {
  status?: LifeAdminStatus;
  limit: number;
  daysAhead?: number;
}

export type LifeAdminRow = typeof schema.lifeAdminItem.$inferSelect;

export async function createLifeAdminItem(
  ctx: TenantContext,
  input: CreateLifeAdminInput
): Promise<LifeAdminRow> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.lifeAdminItem)
    .values({
      tenantId: ctx.tenantId,
      title: input.title,
      description: input.description,
      dueDate: new Date(input.dueDate),
      recurrence: input.recurrence,
      category: input.category,
      status: 'pending',
      tags: input.tags ?? [],
      tier: input.tier ?? 0,
    })
    .returning();
  return row;
}

export async function getLifeAdminItemById(
  ctx: TenantContext,
  id: string
): Promise<LifeAdminRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.lifeAdminItem)
    .where(and(eq(schema.lifeAdminItem.id, id), eq(schema.lifeAdminItem.tenantId, ctx.tenantId)))
    .limit(1);
  return row;
}

export async function listLifeAdminItems(
  ctx: TenantContext,
  options: LifeAdminListOptions
): Promise<LifeAdminRow[]> {
  const conditions = [eq(schema.lifeAdminItem.tenantId, ctx.tenantId)];

  if (options.status) {
    conditions.push(eq(schema.lifeAdminItem.status, options.status));
  }

  if (options.daysAhead !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + options.daysAhead);
    conditions.push(lte(schema.lifeAdminItem.dueDate, cutoff));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.lifeAdminItem)
    .where(and(...conditions))
    .orderBy(asc(schema.lifeAdminItem.dueDate))
    .limit(options.limit);
}

export async function markLifeAdminDone(
  ctx: TenantContext,
  id: string
): Promise<LifeAdminRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.lifeAdminItem)
    .set({ status: 'done' })
    .where(and(eq(schema.lifeAdminItem.id, id), eq(schema.lifeAdminItem.tenantId, ctx.tenantId)))
    .returning();
  return row;
}
