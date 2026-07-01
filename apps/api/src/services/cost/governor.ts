import { withTenantTransaction } from '../../db/tenant-context';
import { createAuditEvent } from '../../repositories/audit';
import { getTenantDailyCostUsd } from '../../repositories/job';
import { HaltError, setHalted } from '../halt/state';

const DEFAULT_AUTO_HALT_DAILY_USD = 10;
const DEFAULT_MAX_TASK_COST_USD = 5;
const MICROS_PER_DOLLAR = 1_000_000;
const DAILY_HALT_REASON = 'Daily cost threshold exceeded';
const CEILING_HALT_REASON = 'Per-action cost ceiling exceeded';

export class CostGovernor {
  private readonly thresholdMicroUsd: number;
  private readonly maxTaskCostMicroUsd: number;

  constructor() {
    const rawThreshold = process.env.AUTO_HALT_DAILY_USD;
    const parsedThreshold =
      rawThreshold === undefined ? DEFAULT_AUTO_HALT_DAILY_USD : Number(rawThreshold);
    const thresholdUsd =
      Number.isNaN(parsedThreshold) || parsedThreshold < 0
        ? DEFAULT_AUTO_HALT_DAILY_USD
        : parsedThreshold;
    this.thresholdMicroUsd = Math.round(thresholdUsd * MICROS_PER_DOLLAR);

    const rawCeiling = process.env.MAX_TASK_COST_USD;
    const parsedCeiling = rawCeiling === undefined ? DEFAULT_MAX_TASK_COST_USD : Number(rawCeiling);
    const ceilingUsd =
      Number.isNaN(parsedCeiling) || parsedCeiling < 0 ? DEFAULT_MAX_TASK_COST_USD : parsedCeiling;
    this.maxTaskCostMicroUsd = Math.round(ceilingUsd * MICROS_PER_DOLLAR);
  }

  async recordAndCheck(
    tenantId: string,
    _jobId: string,
    costUsd: number,
    actor: string
  ): Promise<void> {
    const now = new Date();
    await withTenantTransaction(tenantId, async (ctx) => {
      if (costUsd > this.maxTaskCostMicroUsd) {
        await setHalted(CEILING_HALT_REASON, actor, tenantId);
        await createAuditEvent(ctx, {
          actor,
          action: 'auto_halt_triggered',
          tier: 2,
          payload: {
            reason: CEILING_HALT_REASON,
            maxTaskCostUsd: this.maxTaskCostMicroUsd,
            projectedCostUsd: costUsd,
          },
        });
        throw new HaltError({
          halted: true,
          reason: CEILING_HALT_REASON,
          triggeredBy: actor,
          triggeredAt: now.toISOString(),
        });
      }

      const dailyCostUsd = await getTenantDailyCostUsd(ctx, now);
      const projected = dailyCostUsd + costUsd;

      if (projected > this.thresholdMicroUsd) {
        await setHalted(DAILY_HALT_REASON, actor, tenantId);
        await createAuditEvent(ctx, {
          actor,
          action: 'auto_halt_triggered',
          tier: 2,
          payload: {
            reason: DAILY_HALT_REASON,
            thresholdUsd: this.thresholdMicroUsd,
            dailyCostUsd,
            projectedCostUsd: projected,
          },
        });
        throw new HaltError({
          halted: true,
          reason: DAILY_HALT_REASON,
          triggeredBy: actor,
          triggeredAt: now.toISOString(),
        });
      }
    });
  }
}

export async function checkRunawayCost(
  tenantId: string,
  jobId: string,
  costUsd: number,
  actor: string
): Promise<void> {
  const governor = new CostGovernor();
  return governor.recordAndCheck(tenantId, jobId, costUsd, actor);
}
