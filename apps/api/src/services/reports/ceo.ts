import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import { BudgetService } from '../cost/budget';
import { getHaltState } from '../halt/state';

const MICROS_PER_DOLLAR = 1_000_000;

export interface CeoReport {
  generatedAt: string;
  taskHealth: {
    total: number;
    byStatus: Record<string, number>;
    recentFailures: Array<{
      id: string;
      type: string;
      status: string;
      createdAt: string;
    }>;
  };
  burn: {
    dailySpendUsd: number;
    dailyBudgetUsd: number | null;
    throttled: boolean;
    exceeded: boolean;
  };
  risk: {
    halted: boolean;
    haltReason?: string;
    needsAttentionCount: number;
    failedCount: number;
  };
  decisions: {
    pendingApprovalsCount: number;
    recentPendingApprovals: Array<{
      id: string;
      jobId: string;
      reason: string | null;
      requestedBy: string;
      createdAt: string;
    }>;
  };
}

export class CeoReportService {
  private budgetService = new BudgetService();

  async build(ctx: TenantContext): Promise<CeoReport> {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [jobStats, recentFailures, needsAttention, failed, dailySpend, budgetStatus, approvals] =
      await Promise.all([
        this.getJobStats(ctx),
        this.getRecentFailures(ctx, 5),
        this.getJobCount(ctx, 'needs_attention'),
        this.getJobCount(ctx, 'failed'),
        this.getDailySpend(ctx, startOfDay, endOfDay),
        this.budgetService.getStatus(ctx, now),
        this.getPendingApprovals(ctx, 5),
      ]);

    const haltState = await getHaltState();

    return {
      generatedAt: now.toISOString(),
      taskHealth: {
        total: Object.values(jobStats).reduce((sum, count) => sum + count, 0),
        byStatus: jobStats,
        recentFailures,
      },
      burn: {
        dailySpendUsd: dailySpend / MICROS_PER_DOLLAR,
        dailyBudgetUsd: budgetStatus.dailyBudgetUsd / MICROS_PER_DOLLAR,
        throttled: budgetStatus.throttled,
        exceeded: budgetStatus.exceeded,
      },
      risk: {
        halted: haltState.halted,
        haltReason: haltState.reason,
        needsAttentionCount: needsAttention,
        failedCount: failed,
      },
      decisions: {
        pendingApprovalsCount: approvals.total,
        recentPendingApprovals: approvals.recent,
      },
    };
  }

  private async getJobStats(ctx: TenantContext): Promise<Record<string, number>> {
    const statuses = ['queued', 'running', 'blocked', 'needs_attention', 'done', 'failed'] as const;
    const rows = await ctx.tenantScopedDb
      .select({
        status: schema.job.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.job)
      .where(eq(schema.job.tenantId, ctx.tenantId))
      .groupBy(schema.job.status);

    const stats: Record<string, number> = {};
    for (const status of statuses) {
      stats[status] = 0;
    }
    for (const row of rows) {
      stats[row.status] = Number(row.count);
    }
    return stats;
  }

  private async getRecentFailures(ctx: TenantContext, limit: number) {
    const rows = await ctx.tenantScopedDb
      .select({
        id: schema.job.id,
        type: schema.job.type,
        status: schema.job.status,
        createdAt: schema.job.createdAt,
      })
      .from(schema.job)
      .where(
        and(
          eq(schema.job.tenantId, ctx.tenantId),
          inArray(schema.job.status, ['failed', 'needs_attention'])
        )
      )
      .orderBy(desc(schema.job.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async getJobCount(
    ctx: TenantContext,
    status: (typeof schema.job.status.enumValues)[number]
  ) {
    const [row] = await ctx.tenantScopedDb
      .select({ count: sql<number>`count(*)` })
      .from(schema.job)
      .where(and(eq(schema.job.tenantId, ctx.tenantId), eq(schema.job.status, status)));
    return Number(row?.count ?? 0);
  }

  private async getDailySpend(ctx: TenantContext, start: Date, end: Date) {
    const [row] = await ctx.tenantScopedDb
      .select({
        total: sql<number>`coalesce(sum(${schema.job.costUsd}), 0)`,
      })
      .from(schema.job)
      .where(
        and(
          eq(schema.job.tenantId, ctx.tenantId),
          gte(schema.job.createdAt, start),
          lt(schema.job.createdAt, end)
        )
      );
    return Number(row?.total ?? 0);
  }

  private async getPendingApprovals(
    ctx: TenantContext,
    limit: number
  ): Promise<{ total: number; recent: CeoReport['decisions']['recentPendingApprovals'] }> {
    const rows = await ctx.tenantScopedDb
      .select({
        id: schema.approval.id,
        jobId: schema.approval.jobId,
        reason: schema.approval.reason,
        requestedBy: schema.approval.requestedBy,
        createdAt: schema.approval.createdAt,
      })
      .from(schema.approval)
      .where(and(eq(schema.approval.tenantId, ctx.tenantId), eq(schema.approval.status, 'pending')))
      .orderBy(desc(schema.approval.createdAt));

    return {
      total: rows.length,
      recent: rows.slice(0, limit).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
