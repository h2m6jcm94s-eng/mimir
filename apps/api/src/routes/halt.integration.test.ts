import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAuth } from '../middleware/auth';
import { haltRoutes } from './halt';

vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('halt routes', () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CLERK_SECRET_KEY = undefined;

    await registerAuth(app);
    await app.register(rateLimit, { max: 10_000, timeWindow: '1 minute' });
    app.addHook('preHandler', async (request) => {
      if (request.url.startsWith('/v1/halt')) {
        request.user = {
          userId: 'user-1',
          tenantId: 'tenant-1',
          role: 'owner',
          clerkId: 'clerk_test',
        };
      }
    });
    await app.register(haltRoutes, { prefix: '/v1/halt' });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns current halt state', async () => {
    const { redis } = await import('../db/redis.js');
    vi.mocked(redis.get).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/halt',
      headers: { Authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ halted: false });
  });

  it('POST sets halt state and returns it', async () => {
    const { redis } = await import('../db/redis.js');
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ reason: 'stop', triggeredAt: '2024-01-01T00:00:00Z', triggeredBy: 'user-1' })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/halt',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'stop' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.halted).toBe(true);
    expect(body.reason).toBe('stop');
    expect(body.triggeredBy).toBe('user-1');
    expect(redis.set).toHaveBeenCalled();
  });

  it('DELETE clears halt state', async () => {
    const { redis } = await import('../db/redis.js');
    vi.mocked(redis.del).mockResolvedValue(1);

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/halt',
      headers: { Authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ halted: false });
    expect(redis.del).toHaveBeenCalledWith('mimir:halt');
  });
});
