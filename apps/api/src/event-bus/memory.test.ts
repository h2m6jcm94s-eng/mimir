import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from './memory';

describe('InMemoryEventBus', () => {
  it('delivers published events to subscribers', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();

    await bus.subscribe('job.created', handler);
    const event = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      jobId: '550e8400-e29b-41d4-a716-446655440002',
      type: 'job.created' as const,
      payload: { type: 'echo' },
      createdAt: new Date().toISOString(),
    };

    await bus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver events after unsubscribe', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();

    const unsubscribe = await bus.subscribe('job.created', handler);
    await unsubscribe();

    await bus.publish({
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      jobId: '550e8400-e29b-41d4-a716-446655440002',
      type: 'job.created',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not break publishing when a subscriber throws', async () => {
    const bus = new InMemoryEventBus();
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const succeeding = vi.fn();

    await bus.subscribe('job.created', failing);
    await bus.subscribe('job.created', succeeding);

    await bus.publish({
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      jobId: '550e8400-e29b-41d4-a716-446655440002',
      type: 'job.created',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    expect(succeeding).toHaveBeenCalled();
  });
});
