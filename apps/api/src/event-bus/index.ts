import { redis } from '../db/redis';
import { InMemoryEventBus } from './memory';
import { RedisEventBus } from './redis';
import type { EventBus } from './types';
import { jobEventBroadcastTopic, jobEventTopic } from './types';

export * from './types';

let bus: EventBus | undefined;

export function getEventBus(): EventBus {
  if (!bus) {
    bus = createEventBus();
  }
  return bus;
}

export function createEventBus(): EventBus {
  if (process.env.EVENT_BUS_ENABLED === 'false') {
    return new InMemoryEventBus();
  }
  try {
    const subscriber = redis.duplicate();
    return new RedisEventBus(redis, subscriber);
  } catch {
    return new InMemoryEventBus();
  }
}

export function resetEventBus(): void {
  bus = undefined;
}

export { jobEventBroadcastTopic, jobEventTopic };
