import { beforeEach, describe, expect, it, vi } from 'vitest';
import { build } from './activities';

const haltError = Object.assign(new Error('Halt active'), { name: 'HaltError' });

vi.mock('../services/halt/state', () => ({
  throwIfHalted: vi.fn(),
  HaltError: class HaltError extends Error {
    constructor(_state: unknown) {
      super('Halt active');
      this.name = 'HaltError';
    }
  },
}));

describe('Temporal activities halt guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('build throws when emergency halt is active', async () => {
    const { throwIfHalted } = await import('../services/halt/state.js');
    vi.mocked(throwIfHalted).mockRejectedValue(haltError);

    await expect(
      build({
        tenantId: 'tenant-1',
        userId: 'user-1',
        jobId: 'job-1',
        idempotencyKey: 'key-1',
        type: 'echo',
        tier: 0,
        source: 'api',
        payload: {},
      })
    ).rejects.toThrow('Halt active');

    expect(throwIfHalted).toHaveBeenCalledWith('tenant-1');
  });
});
