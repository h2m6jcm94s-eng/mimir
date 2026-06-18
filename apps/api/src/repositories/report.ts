import type { ReportKind } from '@mimir/shared-types';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateReportInput {
  tenantId: string;
  title: string;
  description?: string;
  kind: (typeof schema.report.$inferInsert)['kind'];
  status?: (typeof schema.report.$inferInsert)['status'];
}

export async function createReport(ctx: TenantContext, input: CreateReportInput) {
  const [report] = await ctx.tenantScopedDb
    .insert(schema.report)
    .values({
      tenantId: ctx.tenantId,
      title: input.title,
      description: input.description ?? '',
      kind: input.kind,
      status: input.status ?? 'scheduled',
    })
    .returning();
  return report;
}

export async function listReports(ctx: TenantContext, limit: number) {
  return ctx.tenantScopedDb
    .select()
    .from(schema.report)
    .orderBy(desc(schema.report.createdAt))
    .limit(limit);
}

export async function searchReports(
  ctx: TenantContext,
  options: { q?: string; kind?: ReportKind; limit: number }
) {
  const conditions: Parameters<typeof and>[number][] = [];

  if (options.kind) {
    conditions.push(eq(schema.report.kind, options.kind));
  }

  if (options.q) {
    const term = `%${options.q}%`;
    conditions.push(or(ilike(schema.report.title, term), ilike(schema.report.description, term)));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.report)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.report.createdAt))
    .limit(options.limit);
}

export async function getReport(ctx: TenantContext, id: string) {
  const [found] = await ctx.tenantScopedDb
    .select()
    .from(schema.report)
    .where(eq(schema.report.id, id));
  return found;
}
