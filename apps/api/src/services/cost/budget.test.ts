import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetExceededError, BudgetService, BudgetThrottledError } from './budget';

const MICROS_PER_DOLLAR = 1_000_000;

vi.mock('../../repositories/budget', () => ({
  getBudget: vi.fn(),
  upsertBudget: vi.fn(),
}));

vi.mock('../../repositories/job', () => ({
  addJobCost: vi.fn(),
  createJob: vi.fn(),
  findJobByIdempotency: vi.fn(),
  getJob: vi.fn(),
  getTenantDailyCostUsd: vi.fn(),
  getTenantHourlyBurnUsd: vi.fn(),
  getTenantMonthlyCostUsd: vi.fn(),
  listJobs: vi.fn(),
  updateJobStatus: vi.fn(),
}));

vi.mock('../../services/halt/state', () => ({
  setHalted: vi.fn().mockResolvedValue(undefined),
  clearHalt: vi.fn(),
  getHaltState: vi.fn(),
  isHalted: vi.fn(),
  throwIfHalted: vi.fn(),
  HaltError: class HaltError extends Error {
    constructor(state: { reason?: string; triggeredBy?: string }) {
      super(`Emergency halt is active: ${state.reason || 'no reason provided'}`);
      this.name = 'HaltError';
    }
  },
}));

vi.mock('../../db/tenant-context', () => ({
  withTenantTransaction: vi.fn(async (_tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
    fn({ tenantId: 'tenant-1', tenantScopedDb: {} })
  ),
  TenantContext: class {},
}));

describe('BudgetService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function mockBudget(overrides: {
    dailyBudgetUsd?: number;
    monthlyBudgetUsd?: number;
    throttleThreshold?: number;
    enabled?: boolean;
  }) {
    const { getBudget } = await import('../../repositories/budget.js');
    vi.mocked(getBudget).mockResolvedValue({
      id: 'budget-1',
      tenantId: 'tenant-1',
      dailyBudgetUsd: overrides.dailyBudgetUsd ?? 10 * MICROS_PER_DOLLAR,
      monthlyBudgetUsd: overrides.monthlyBudgetUsd ?? 100 * MICROS_PER_DOLLAR,
      throttleThreshold: String(overrides.throttleThreshold ?? 0.8),
      enabled: overrides.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof getBudget>>);
  }

  it('reports status with unlimited defaults when no budget exists', async () => {
    const { getBudget } = await import('../../repositories/budget.js');
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    vi.mocked(getBudget).mockResolvedValue(undefined as never);
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(5 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(20 * MICROS_PER_DOLLAR);

    const service = new BudgetService();
    const status = await service.getStatus({ tenantId: 'tenant-1' } as never, new Date());

    expect(status.enabled).toBe(false);
    expect(status.dailySpendUsd).toBe(5 * MICROS_PER_DOLLAR);
    expect(status.monthlySpendUsd).toBe(20 * MICROS_PER_DOLLAR);
    expect(status.exceeded).toBe(false);
    expect(status.throttled).toBe(false);
  });

  it('marks budget as exceeded when daily spend is over the limit', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({ dailyBudgetUsd: 10 * MICROS_PER_DOLLAR });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(11 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(0);

    const service = new BudgetService();
    const status = await service.getStatus({ tenantId: 'tenant-1' } as never, new Date());

    expect(status.exceeded).toBe(true);
    expect(status.dailyRemainingUsd).toBe(0);
  });

  it('marks budget as throttled when daily spend crosses the threshold', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({ dailyBudgetUsd: 10 * MICROS_PER_DOLLAR, throttleThreshold: 0.8 });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(8 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(0);

    const service = new BudgetService();
    const status = await service.getStatus({ tenantId: 'tenant-1' } as never, new Date());

    expect(status.throttled).toBe(true);
  });

  it('denies tier-2 actions when throttled', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({ dailyBudgetUsd: 10 * MICROS_PER_DOLLAR, throttleThreshold: 0.8 });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(8 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(0);

    const service = new BudgetService();
    await expect(
      service.checkAction({ tenantId: 'tenant-1' } as never, { tier: 2, projectedCostUsd: 0 })
    ).rejects.toThrow(BudgetThrottledError);
  });

  it('allows tier-0/1 actions when throttled', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({ dailyBudgetUsd: 10 * MICROS_PER_DOLLAR, throttleThreshold: 0.8 });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(8 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(0);

    const service = new BudgetService();
    await expect(
      service.checkAction({ tenantId: 'tenant-1' } as never, { tier: 1, projectedCostUsd: 0 })
    ).resolves.toBeUndefined();
  });

  it('throws BudgetExceededError when projected daily spend exceeds the budget', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({ dailyBudgetUsd: 10 * MICROS_PER_DOLLAR });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(9 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(0);

    const service = new BudgetService();
    await expect(
      service.checkAction({ tenantId: 'tenant-1' } as never, {
        tier: 1,
        projectedCostUsd: 2 * MICROS_PER_DOLLAR,
      })
    ).rejects.toThrow(BudgetExceededError);
  });

  it('falls back to the env-based CostGovernor when no budget is set', async () => {
    const { getBudget } = await import('../../repositories/budget.js');
    const { getTenantDailyCostUsd } = await import('../../repositories/job.js');
    const { setHalted } = await import('../../services/halt/state.js');
    vi.mocked(getBudget).mockResolvedValue(undefined as never);
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(9 * MICROS_PER_DOLLAR);
    process.env.AUTO_HALT_DAILY_USD = '10';

    const service = new BudgetService();
    await expect(
      service.checkAction({ tenantId: 'tenant-1' } as never, {
        tier: 2,
        projectedCostUsd: 2 * MICROS_PER_DOLLAR,
      })
    ).rejects.toThrow('Daily cost threshold exceeded');

    expect(setHalted).toHaveBeenCalledWith('Daily cost threshold exceeded', 'system');
  });

  it('forecasts end-of-day and end-of-month spend from hourly burn', async () => {
    const { getTenantDailyCostUsd, getTenantMonthlyCostUsd, getTenantHourlyBurnUsd } = await import(
      '../../repositories/job.js'
    );
    await mockBudget({
      dailyBudgetUsd: 10 * MICROS_PER_DOLLAR,
      monthlyBudgetUsd: 100 * MICROS_PER_DOLLAR,
    });
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(2 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantMonthlyCostUsd).mockResolvedValue(10 * MICROS_PER_DOLLAR);
    vi.mocked(getTenantHourlyBurnUsd).mockResolvedValue(0.5 * MICROS_PER_DOLLAR);

    const service = new BudgetService();
    const now = new Date(Date.UTC(2026, 5, 17, 12, 0, 0));
    const forecast = await service.forecast({ tenantId: 'tenant-1' } as never, now);

    expect(forecast.averageHourlyBurnUsd).toBe(0.5 * MICROS_PER_DOLLAR);
    expect(forecast.projectedEndOfDayUsd).toBeGreaterThan(2 * MICROS_PER_DOLLAR);
    expect(forecast.projectedMonthEndUsd).toBeGreaterThan(10 * MICROS_PER_DOLLAR);
    expect(forecast.daysUntilDailyBudgetDepleted).toBeGreaterThan(0);
    expect(forecast.daysUntilMonthlyBudgetDepleted).toBeGreaterThan(0);
  });
});
