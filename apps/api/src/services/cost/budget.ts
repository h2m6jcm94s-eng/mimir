import type { TenantContext } from '../../db/tenant-context';
import { getBudget } from '../../repositories/budget';
import {
  getTenantDailyCostUsd,
  getTenantHourlyBurnUsd,
  getTenantMonthlyCostUsd,
} from '../../repositories/job';
import { CostGovernor } from './governor';

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class BudgetThrottledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetThrottledError';
  }
}

export interface BudgetStatus {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  dailySpendUsd: number;
  monthlySpendUsd: number;
  dailyRemainingUsd: number;
  monthlyRemainingUsd: number;
  throttleThreshold: number;
  throttled: boolean;
  exceeded: boolean;
  enabled: boolean;
}

export interface BudgetForecast {
  projectedEndOfDayUsd: number;
  projectedMonthEndUsd: number;
  daysUntilDailyBudgetDepleted: number | null;
  daysUntilMonthlyBudgetDepleted: number | null;
  averageHourlyBurnUsd: number;
}

export class BudgetService {
  async getStatus(ctx: TenantContext, now: Date): Promise<BudgetStatus> {
    const budget = await getBudget(ctx);
    const dailySpend = await getTenantDailyCostUsd(ctx, now);
    const monthlySpend = await getTenantMonthlyCostUsd(ctx, now);

    if (!budget) {
      return {
        dailyBudgetUsd: 0,
        monthlyBudgetUsd: 0,
        dailySpendUsd: dailySpend,
        monthlySpendUsd: monthlySpend,
        dailyRemainingUsd: 0,
        monthlyRemainingUsd: 0,
        throttleThreshold: 0.8,
        throttled: false,
        exceeded: false,
        enabled: false,
      };
    }

    const dailyBudget = budget.dailyBudgetUsd;
    const monthlyBudget = budget.monthlyBudgetUsd;
    const throttleThreshold = Number(budget.throttleThreshold);

    const dailyRemaining = dailyBudget > 0 ? Math.max(0, dailyBudget - dailySpend) : 0;
    const monthlyRemaining = monthlyBudget > 0 ? Math.max(0, monthlyBudget - monthlySpend) : 0;

    const dailyExceeded = dailyBudget > 0 && dailySpend >= dailyBudget;
    const monthlyExceeded = monthlyBudget > 0 && monthlySpend >= monthlyBudget;
    const throttled =
      budget.enabled && dailyBudget > 0 && dailySpend >= dailyBudget * throttleThreshold;

    return {
      dailyBudgetUsd: dailyBudget,
      monthlyBudgetUsd: monthlyBudget,
      dailySpendUsd: dailySpend,
      monthlySpendUsd: monthlySpend,
      dailyRemainingUsd: dailyRemaining,
      monthlyRemainingUsd: monthlyRemaining,
      throttleThreshold,
      throttled,
      exceeded: dailyExceeded || monthlyExceeded,
      enabled: budget.enabled,
    };
  }

  async forecast(ctx: TenantContext, now: Date): Promise<BudgetForecast> {
    const budget = await getBudget(ctx);
    const dailySpend = await getTenantDailyCostUsd(ctx, now);
    const monthlySpend = await getTenantMonthlyCostUsd(ctx, now);
    const hourlyBurn = await getTenantHourlyBurnUsd(ctx, now, 24);

    const dailyBudget = budget?.dailyBudgetUsd ?? 0;
    const monthlyBudget = budget?.monthlyBudgetUsd ?? 0;

    const endOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const hoursUntilEod = Math.max(0, (endOfDay.getTime() - now.getTime()) / 3_600_000);

    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const hoursUntilEom = Math.max(0, (endOfMonth.getTime() - now.getTime()) / 3_600_000);

    const projectedEndOfDayUsd = Math.round(dailySpend + hourlyBurn * hoursUntilEod);
    const projectedMonthEndUsd = Math.round(monthlySpend + hourlyBurn * hoursUntilEom);

    const daysUntilDailyBudgetDepleted =
      budget?.enabled && dailyBudget > 0 && hourlyBurn > 0
        ? Math.max(0, (dailyBudget - dailySpend) / hourlyBurn / 24)
        : null;

    const daysUntilMonthlyBudgetDepleted =
      budget?.enabled && monthlyBudget > 0 && hourlyBurn > 0
        ? Math.max(0, (monthlyBudget - monthlySpend) / hourlyBurn / 24)
        : null;

    return {
      projectedEndOfDayUsd,
      projectedMonthEndUsd,
      daysUntilDailyBudgetDepleted,
      daysUntilMonthlyBudgetDepleted,
      averageHourlyBurnUsd: hourlyBurn,
    };
  }

  async checkAction(
    ctx: TenantContext,
    request: { tier: number; projectedCostUsd: number; actor?: string }
  ): Promise<void> {
    const budget = await getBudget(ctx);

    if (budget?.enabled) {
      const now = new Date();
      const dailySpend = await getTenantDailyCostUsd(ctx, now);
      const monthlySpend = await getTenantMonthlyCostUsd(ctx, now);
      const dailyBudget = budget.dailyBudgetUsd;
      const monthlyBudget = budget.monthlyBudgetUsd;
      const throttleThreshold = Number(budget.throttleThreshold);

      if (dailyBudget > 0 && dailySpend + request.projectedCostUsd > dailyBudget) {
        throw new BudgetExceededError('Daily budget exceeded');
      }

      if (monthlyBudget > 0 && monthlySpend + request.projectedCostUsd > monthlyBudget) {
        throw new BudgetExceededError('Monthly budget exceeded');
      }

      if (dailyBudget > 0 && request.tier === 2 && dailySpend >= dailyBudget * throttleThreshold) {
        throw new BudgetThrottledError('Daily budget throttle: cloud-tier actions paused');
      }
    }

    const governor = new CostGovernor();
    await governor.recordAndCheck(
      ctx.tenantId,
      '',
      request.projectedCostUsd,
      request.actor ?? 'system'
    );
  }
}
