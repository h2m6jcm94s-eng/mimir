import { describe, expect, it } from 'vitest';
import { checkPolicyConformance } from './policy-conformance';

const baseClassification = {
  tier: 1 as const,
  confidence: 0.9,
  reason: 'test',
  fallback: false,
  policyVersion: '1.0',
  assignedTier: 1 as const,
  matchedRule: 'public_task',
  signals: ['public_task'],
};

describe('checkPolicyConformance', () => {
  it('returns conformant when policy allows and confidence is high', () => {
    const result = checkPolicyConformance(baseClassification, {
      effect: 'allow',
      reason: 'ok',
    });
    expect(result.conformant).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it('flags low confidence fallback', () => {
    const result = checkPolicyConformance(
      { ...baseClassification, fallback: true },
      { effect: 'allow', reason: 'ok' }
    );
    expect(result.conformant).toBe(false);
    expect(result.flags).toContain('low_confidence');
  });

  it('flags policy denial', () => {
    const result = checkPolicyConformance(baseClassification, {
      effect: 'deny',
      reason: 'banned',
    });
    expect(result.conformant).toBe(false);
    expect(result.flags).toContain('policy_denied');
    expect(result.flags).toContain('classifier_would_allow_but_policy_denies');
  });

  it('flags policy requiring approval', () => {
    const result = checkPolicyConformance(baseClassification, {
      effect: 'require_approval',
      reason: 'needs approval',
    });
    expect(result.conformant).toBe(false);
    expect(result.flags).toContain('policy_requires_approval');
  });

  it('does not emit classifier_would_allow_but_policy_denies when assigned tier is already 0', () => {
    const result = checkPolicyConformance(
      { ...baseClassification, tier: 0, assignedTier: 0 as const },
      { effect: 'deny', reason: 'banned' }
    );
    expect(result.flags).toContain('policy_denied');
    expect(result.flags).not.toContain('classifier_would_allow_but_policy_denies');
  });
});
