import { describe, expect, it } from 'vitest';
import { verifyChain } from './audit';
import type { AuditEvent } from './audit';

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    tenantId: '00000000-0000-0000-0000-000000000000',
    prevHash: null,
    hash: 'placeholder',
    actor: 'user-1',
    action: 'test_action',
    tier: 0,
    payloadHash: 'payload-hash',
    sources: [],
    ts: new Date('2026-06-16T00:00:00.000Z'),
    ...overrides,
  };
}

describe('verifyChain', () => {
  it('validates a chain of one event', () => {
    const event = makeEvent({
      prevHash: null,
      hash: '45c4c15ed4679fbbe596534e8ee795136b3b49d60bc81287800197dfd805ff62',
      ts: new Date('2026-06-16T00:00:00.000Z'),
    });
    expect(verifyChain([event])).toBe(true);
  });

  it('rejects a chain where an event hash is tampered', () => {
    const event = makeEvent({
      prevHash: null,
      hash: 'tampered',
      ts: new Date('2026-06-16T00:00:00.000Z'),
    });
    expect(verifyChain([event])).toBe(false);
  });
});
