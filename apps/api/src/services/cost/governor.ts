import { withTenantTransaction } from '../../db/tenant-context';
import { getTenantDailyCostUsd } from '../../repositories/job';
import { HaltError, setHalted } from '../halt/state';

const DEFAULT_AUTO_HALT_DAILY_USD = 10;
const MICROS_PER_DOLLAR = 1_000_000;
const HALT_REASON = 'Daily cost threshold exceeded';

export class CostGovernor {
  private readonly thresholdMicroUsd: number;

  constructor() {
    const raw = process.env.AUTO_HALT_DAILY_USD;
    const parsed = raw === undefined ? DEFAULT_AUTO_HALT_DAILY_USD : Number(raw);
    const dollars = Number.isNaN(parsed) || parsed < 0 ? DEFAULT_AUTO_HALT_DAILY_USD : parsed;
    this.thresholdMicroUsd = Math.round(dollars * MICROS_PER_DOLLAR);
  }

  async recordAndCheck(
    tenantId: string,
    _jobId: string,
    costUsd: number,
    actor: string
  ): Promise<void> {
    const now = new Date();
    await withTenantTransaction(tenantId, async (ctx) => {
      const dailyCostUsd = await getTenantDailyCostUsd(ctx, now);
      const projected = dailyCostUsd + costUsd;

      if (projected > this.thresholdMicroUsd) {
        await setHalted(HALT_REASON, actor);
        throw new HaltError({
          halted: true,
          reason: HALT_REASON,
          triggeredBy: actor,
          triggeredAt: new Date().toISOString(),
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
