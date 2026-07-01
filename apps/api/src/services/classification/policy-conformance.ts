import type { ClassificationResult, PolicyDecision } from '@mimir/shared-types';

export interface ConformanceCheck {
  conformant: boolean;
  flags: string[];
}

export function checkPolicyConformance(
  classification: ClassificationResult,
  policyDecision: PolicyDecision
): ConformanceCheck {
  const flags: string[] = [];

  if (classification.fallback) {
    flags.push('low_confidence');
  }

  if (policyDecision.effect === 'deny') {
    flags.push('policy_denied');
  }

  if (policyDecision.effect === 'require_approval') {
    flags.push('policy_requires_approval');
  }

  // The classifier routed to a tier that the active policy denies for this action.
  // This is the key misalignment we want to surface for R-15.
  if (
    policyDecision.effect === 'deny' &&
    classification.assignedTier !== undefined &&
    classification.assignedTier !== 0
  ) {
    flags.push('classifier_would_allow_but_policy_denies');
  }

  return {
    conformant: flags.length === 0,
    flags,
  };
}
