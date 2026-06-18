import type { JobEvent } from '@mimir/shared-types';
import type Redis from 'ioredis';
import type { EventBus, EventHandler } from './types';

export class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, Set<EventHandler>>();
  private listening = false;

  constructor(publisher: Redis, subscriber: Redis) {
    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  async publish(event: JobEvent): Promise<void> {
    const message = JSON.stringify(event);
    await this.publisher.publish(`mimir:events:${event.type}`, message);
    await this.publisher.publish('mimir:events:*', message);
  }

  async subscribe(topic: string, handler: EventHandler): Promise<() => void> {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)?.add(handler);

    if (!this.listening) {
      this.subscriber.on('message', (channel, message) => {
        const event = JSON.parse(message) as JobEvent;
        const topic = channel.replace('mimir:events:', '');
        const handlers = new Set([
          ...(this.handlers.get(topic) ?? []),
          ...(this.handlers.get('*') ?? []),
        ]);
        for (const h of handlers) {
          Promise.resolve(h(event)).catch((err) => console.error('Event handler failed:', err));
        }
      });
      this.listening = true;
    }

    const redisTopic = topic === '*' ? 'mimir:events:*' : `mimir:events:${topic}`;
    await this.subscriber.subscribe(redisTopic);

    return async () => {
      this.handlers.get(topic)?.delete(handler);
      if (this.handlers.get(topic)?.size === 0) {
        await this.subscriber.unsubscribe(redisTopic);
      }
    };
  }

  async close(): Promise<void> {
    await this.subscriber.removeAllListeners('message');
  }
}
