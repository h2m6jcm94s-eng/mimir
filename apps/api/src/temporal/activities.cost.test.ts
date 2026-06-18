import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { build } from './activities';

const MICROS_PER_DOLLAR = 1_000_000;

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('../db/tenant-context', () => ({
  withTenantTransaction: vi.fn(async (_tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
    fn({ tenantScopedDb: {} })
  ),
  TenantContext: class {},
}));

vi.mock('../services/models/router', () => ({
  ModelRouter: class {
    async invoke(...args: unknown[]) {
      return invokeMock(...args);
    }
  },
}));

vi.mock('../repositories/job', () => ({
  addJobCost: vi.fn(),
  createJob: vi.fn(),
  findJobByIdempotency: vi.fn(),
  getJob: vi.fn(),
  getTenantDailyCostUsd: vi.fn(),
  getTenantMonthlyCostUsd: vi.fn(),
  getTenantHourlyBurnUsd: vi.fn(),
  listJobs: vi.fn(),
  updateJobStatus: vi.fn(),
}));

vi.mock('../repositories/audit', () => ({
  createAuditEvent: vi.fn(),
}));

vi.mock('../services/events/publisher', () => ({
  publishJobEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../repositories/budget', () => ({
  getBudget: vi.fn().mockResolvedValue(undefined),
  upsertBudget: vi.fn(),
  getSpendSeries: vi.fn(),
}));

vi.mock('../services/halt/state', () => ({
  throwIfHalted: vi.fn().mockResolvedValue(undefined),
  setHalted: vi.fn().mockResolvedValue(undefined),
  clearHalt: vi.fn(),
  getHaltState: vi.fn(),
  isHalted: vi.fn(),
  HaltError: class HaltError extends Error {
    constructor(state: { reason?: string; triggeredBy?: string }) {
      super(`Emergency halt is active: ${state.reason || 'no reason provided'}`);
      this.name = 'HaltError';
    }
  },
}));

describe('Temporal activities cost circuit-breaker', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, AUTO_HALT_DAILY_USD: '10' };
    vi.clearAllMocks();

    const { getJob, updateJobStatus, addJobCost } = await import('../repositories/job.js');
    vi.mocked(getJob).mockResolvedValue({
      id: 'job-1',
      tenantId: '00000000-0000-0000-0000-000000000000',
      checkpoint: {},
      costUsd: 0,
    } as unknown as Awaited<ReturnType<typeof getJob>>);
    vi.mocked(updateJobStatus).mockResolvedValue({} as Awaited<ReturnType<typeof updateJobStatus>>);
    vi.mocked(addJobCost).mockResolvedValue({
      id: 'job-1',
      costUsd: 3 * MICROS_PER_DOLLAR,
    } as Awaited<ReturnType<typeof addJobCost>>);

    invokeMock.mockResolvedValue({
      text: 'ok',
      costUsd: 3 * MICROS_PER_DOLLAR,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws a HaltError when a model call pushes daily spend over the threshold', async () => {
    const { getTenantDailyCostUsd } = await import('../repositories/job.js');
    const { setHalted } = await import('../services/halt/state.js');
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(8 * MICROS_PER_DOLLAR);

    await expect(
      build({
        tenantId: '00000000-0000-0000-0000-000000000000',
        userId: 'user-1',
        jobId: 'job-1',
        idempotencyKey: 'key-1',
        type: 'echo',
        tier: 0,
        payload: {},
      })
    ).rejects.toThrow('Daily cost threshold exceeded');

    expect(setHalted).toHaveBeenCalledWith('Daily cost threshold exceeded', 'user-1');
  });

  it('completes the build when the projected daily spend stays under the threshold', async () => {
    const { getTenantDailyCostUsd } = await import('../repositories/job.js');
    const { setHalted } = await import('../services/halt/state.js');
    vi.mocked(getTenantDailyCostUsd).mockResolvedValue(1 * MICROS_PER_DOLLAR);

    const result = await build({
      tenantId: '00000000-0000-0000-0000-000000000000',
      userId: 'user-1',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'echo',
      tier: 0,
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(setHalted).not.toHaveBeenCalled();
  });
});
