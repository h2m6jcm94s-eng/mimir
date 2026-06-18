import { desc, eq, gte, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';

export interface CreateCheckInInput {
  userId: string;
  mood: 'great' | 'good' | 'okay' | 'low' | 'rough';
  note?: string;
  tags?: string[];
}

export interface CheckInSummary {
  total: number;
  byMood: Record<string, number>;
  averageMoodScore: number | null;
}

const moodScore: Record<string, number> = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  rough: 1,
};

export async function createCheckIn(
  ctx: TenantContext,
  input: CreateCheckInInput
): Promise<typeof schema.companionCheckIn.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.companionCheckIn)
    .values({
      tenantId: ctx.tenantId,
      userId: input.userId,
      mood: input.mood,
      note: input.note ?? null,
      tags: input.tags ?? [],
    })
    .returning();
  return row;
}

export async function listCheckIns(
  ctx: TenantContext,
  userId: string,
  options: { limit?: number; days?: number } = {}
): Promise<(typeof schema.companionCheckIn.$inferSelect)[]> {
  const limit = options.limit ?? 30;
  const conditions = [eq(schema.companionCheckIn.userId, userId)];
  if (options.days) {
    const since = new Date();
    since.setDate(since.getDate() - options.days);
    conditions.push(gte(schema.companionCheckIn.createdAt, since));
  }

  return ctx.tenantScopedDb.query.companionCheckIn.findMany({
    where: sql.join(conditions, sql` and `),
    orderBy: desc(schema.companionCheckIn.createdAt),
    limit,
  });
}

export async function getCheckInSummary(
  ctx: TenantContext,
  userId: string,
  days = 30
): Promise<CheckInSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await ctx.tenantScopedDb.query.companionCheckIn.findMany({
    where: sql`${eq(schema.companionCheckIn.userId, userId)} and ${gte(
      schema.companionCheckIn.createdAt,
      since
    )}`,
  });

  const byMood: Record<string, number> = {};
  let scoreSum = 0;
  for (const row of rows) {
    byMood[row.mood] = (byMood[row.mood] ?? 0) + 1;
    scoreSum += moodScore[row.mood] ?? 0;
  }

  return {
    total: rows.length,
    byMood,
    averageMoodScore: rows.length > 0 ? scoreSum / rows.length : null,
  };
}
