import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redis } from '../../db/redis';
import { clearHalt, getHaltState, isHalted, setHalted } from './state';

vi.mock('../../db/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('halt state service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns halted=false when no halt key is set', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);

    const result = await isHalted();
    expect(result).toBe(false);
    expect(redis.get).toHaveBeenCalledWith('mimir:halt:global');
  });

  it('returns halted=true when halt key is set', async () => {
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ reason: 'test', triggeredAt: '2024-01-01T00:00:00Z', triggeredBy: 'user-1' })
    );

    const result = await isHalted('tenant-1');
    expect(result).toBe(true);
    expect(redis.get).toHaveBeenCalledWith('mimir:halt:tenant-1');
  });

  it('sets halt state in Redis scoped to a tenant', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');

    await setHalted('reason-a', 'user-2', 'tenant-1');

    expect(redis.set).toHaveBeenCalledWith(
      'mimir:halt:tenant-1',
      expect.stringContaining('"reason":"reason-a"')
    );
    const payload = JSON.parse(vi.mocked(redis.set).mock.calls[0][1] as string);
    expect(payload.triggeredBy).toBe('user-2');
    expect(payload.triggeredAt).toBeDefined();
  });

  it('clears halt state scoped to a tenant', async () => {
    vi.mocked(redis.del).mockResolvedValue(1);

    await clearHalt('tenant-1');

    expect(redis.del).toHaveBeenCalledWith('mimir:halt:tenant-1');
  });

  it('returns full halt state', async () => {
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        reason: 'emergency',
        triggeredAt: '2024-01-01T00:00:00Z',
        triggeredBy: 'user-3',
      })
    );

    const state = await getHaltState('tenant-2');
    expect(state).toEqual({
      halted: true,
      reason: 'emergency',
      triggeredAt: '2024-01-01T00:00:00Z',
      triggeredBy: 'user-3',
    });
    expect(redis.get).toHaveBeenCalledWith('mimir:halt:tenant-2');
  });

  it('fails safe when Redis is unavailable', async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error('Connection refused'));

    const halted = await isHalted();
    const state = await getHaltState();

    expect(halted).toBe(false);
    expect(state.halted).toBe(false);
  });
});
