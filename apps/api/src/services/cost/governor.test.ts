import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTenantDailyCostUsd } from '../../repositories/job';
import { HaltError, setHalted } from '../halt/state';
import { CostGovernor, checkRunawayCost } from './governor';

const MICROS_PER_DOLLAR = 1_000_000;

vi.mock('../../repositories/job', () => ({
  getTenantDailyCostUsd: vi.fn(),
  addJobCost: vi.fn(),
  createJob: vi.fn(),
  findJobByIdempotency: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  updateJobStatus: vi.fn(),
}));

vi.mock('../../services/halt/state', () => ({
  setHalted: vi.fn(),
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
    fn({ tenantScopedDb: {} })
  ),
  TenantContext: class {},
}));

describe('CostGovernor', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not halt when projected spend is under the daily threshold', async () => {
    process.env.AUTO_HALT_DAILY_USD = '10';
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(5 * MICROS_PER_DOLLAR);

    const governor = new CostGovernor();
    await governor.recordAndCheck('tenant-1', 'job-1', 4 * MICROS_PER_DOLLAR, 'user-1');

    expect(setHalted).not.toHaveBeenCalled();
  });

  it('halts when projected spend exceeds the daily threshold', async () => {
    process.env.AUTO_HALT_DAILY_USD = '10';
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(8 * MICROS_PER_DOLLAR);

    const governor = new CostGovernor();
    await expect(
      governor.recordAndCheck('tenant-1', 'job-1', 3 * MICROS_PER_DOLLAR, 'user-1')
    ).rejects.toThrow(HaltError);

    expect(setHalted).toHaveBeenCalledWith('Daily cost threshold exceeded', 'user-1');
  });

  it('uses the default threshold when AUTO_HALT_DAILY_USD is unset', async () => {
    process.env.AUTO_HALT_DAILY_USD = undefined;
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(9 * MICROS_PER_DOLLAR);

    const governor = new CostGovernor();
    await expect(
      governor.recordAndCheck('tenant-1', 'job-1', 2 * MICROS_PER_DOLLAR, 'system')
    ).rejects.toThrow(HaltError);

    expect(setHalted).toHaveBeenCalledWith('Daily cost threshold exceeded', 'system');
  });

  it('exposes a standalone helper that instantiates the governor', async () => {
    process.env.AUTO_HALT_DAILY_USD = '10';
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(11 * MICROS_PER_DOLLAR);

    await expect(
      checkRunawayCost('tenant-1', 'job-1', 1 * MICROS_PER_DOLLAR, 'user-1')
    ).rejects.toThrow(HaltError);

    expect(setHalted).toHaveBeenCalledWith('Daily cost threshold exceeded', 'user-1');
  });
});
