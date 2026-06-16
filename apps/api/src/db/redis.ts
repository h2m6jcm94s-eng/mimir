import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  showFriendlyErrorStack: process.env.NODE_ENV === 'development',
});

export async function pingRedis(): Promise<'ok' | 'error'> {
  try {
    await redis.ping();
    return 'ok';
  } catch (err) {
    console.error('Redis health check failed:', err);
    return 'error';
  }
}
