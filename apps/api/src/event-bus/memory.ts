import type { JobEvent } from '@mimir/shared-types';
import type { EventBus, EventHandler } from './types';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  async publish(event: JobEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? new Set();
    const wildcards = this.handlers.get('*') ?? new Set();
    const all = new Set([...handlers, ...wildcards]);
    for (const handler of all) {
      try {
        await handler(event);
      } catch (err) {
        // Subscribers must not break the publisher; log and continue.
        console.error('Event handler failed:', err);
      }
    }
  }

  async subscribe(topic: string, handler: EventHandler): Promise<() => void> {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    this.handlers.get(topic)?.add(handler);
    return () => {
      this.handlers.get(topic)?.delete(handler);
    };
  }
}
