import { describe, expect, it } from 'vitest';
import {
  APPROVAL_TIMEOUT_MS,
  approvalExpiresAt,
  buildBlastRadius,
  hashPin,
  riskFromTier,
  verifyPin,
} from './metadata';

describe('approval metadata', () => {
  describe('riskFromTier', () => {
    it('returns low for tier 0', () => {
      expect(riskFromTier(0)).toBe('low');
    });

    it('returns medium for tier 1', () => {
      expect(riskFromTier(1)).toBe('medium');
    });

    it('returns high for tier 2', () => {
      expect(riskFromTier(2)).toBe('high');
    });
  });

  describe('approvalExpiresAt', () => {
    it('uses the tiered timeout', () => {
      const from = new Date('2024-01-01T00:00:00.000Z');
      expect(approvalExpiresAt(0, from)).toEqual(new Date(from.getTime() + APPROVAL_TIMEOUT_MS[0]));
      expect(approvalExpiresAt(1, from)).toEqual(new Date(from.getTime() + APPROVAL_TIMEOUT_MS[1]));
      expect(approvalExpiresAt(2, from)).toEqual(new Date(from.getTime() + APPROVAL_TIMEOUT_MS[2]));
    });

    it('falls back to the tier 0 timeout for unknown tiers', () => {
      const from = new Date('2024-01-01T00:00:00.000Z');
      expect(approvalExpiresAt(99, from)).toEqual(
        new Date(from.getTime() + APPROVAL_TIMEOUT_MS[0])
      );
    });
  });

  describe('buildBlastRadius', () => {
    it('copies the provided fields', () => {
      const radius = buildBlastRadius({
        tier: 2,
        action: 'send_email',
        connectors: ['gmail'],
        summary: 'Sends an email to 5 recipients',
      });

      expect(radius).toEqual({
        tier: 2,
        action: 'send_email',
        connectors: ['gmail'],
        summary: 'Sends an email to 5 recipients',
      });
    });
  });

  describe('hashPin and verifyPin', () => {
    it('verifies a correct PIN', () => {
      const hash = hashPin('1234');
      expect(verifyPin('1234', hash)).toBe(true);
    });

    it('rejects an incorrect PIN', () => {
      const hash = hashPin('1234');
      expect(verifyPin('9999', hash)).toBe(false);
    });

    it('passes when no PIN is configured', () => {
      expect(verifyPin('', null)).toBe(true);
      expect(verifyPin(undefined, undefined)).toBe(true);
    });

    it('rejects a missing PIN when a hash is configured', () => {
      const hash = hashPin('1234');
      expect(verifyPin('', hash)).toBe(false);
      expect(verifyPin(undefined, hash)).toBe(false);
    });
  });
});
