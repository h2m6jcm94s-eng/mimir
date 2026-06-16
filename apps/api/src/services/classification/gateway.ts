import type { ClassificationRequest, ClassificationResult } from '@mimir/shared-types';
import { DEFAULT_CLASSIFICATION_THRESHOLD } from '@mimir/shared-types';

export interface ClassificationPolicy {
  version: string;
  threshold: number;
  rules: Array<{
    name: string;
    tier: 0 | 1 | 2;
    patterns: RegExp[];
    weight: number;
  }>;
}

const DEFAULT_POLICY: ClassificationPolicy = {
  version: '1.0',
  threshold: DEFAULT_CLASSIFICATION_THRESHOLD,
  rules: [
    {
      name: 'pii_or_secrets',
      tier: 0,
      patterns: [
        /\b\d{3}-\d{2}-\d{4}\b/gi, // SSN-like
        /password|secret|token|api[_-]?key|private[_-]?key/gi,
        /ssn|social security|passport|credit card/gi,
      ],
      weight: 1.0,
    },
    {
      name: 'proprietary_code',
      tier: 0,
      patterns: [
        /proprietary|confidential|internal only|do not share/gi,
        /class \w+ extends|function \w+\(|def \w+\(/g,
      ],
      weight: 0.6,
    },
    {
      name: 'public_task',
      tier: 2,
      patterns: [/summarize this public article|check the weather|public page|news/gi],
      weight: 0.4,
    },
  ],
};

export class ClassificationGateway {
  constructor(private readonly policy: ClassificationPolicy = DEFAULT_POLICY) {}

  classify(request: ClassificationRequest): ClassificationResult {
    const text = [
      request.prompt,
      ...request.retrievedContext,
      ...request.attachments.map((a) => a.name),
    ].join(' ');

    let score = 0;
    let matchedRule: string | undefined;
    let assignedTier: 0 | 1 | 2 = 1; // default to local compute

    for (const rule of this.policy.rules) {
      const matches = rule.patterns.reduce((count, pattern) => {
        return count + (text.match(pattern)?.length || 0);
      }, 0);

      if (matches > 0) {
        const ruleScore = Math.min(matches * rule.weight, 1);
        if (ruleScore > score) {
          score = ruleScore;
          assignedTier = rule.tier;
          matchedRule = rule.name;
        }
      }
    }

    const confidence = Math.min(Math.max(score, 0.1), 1);
    const fallback = confidence < this.policy.threshold;

    // Conservative fallback: when in doubt, route to the most private tier
    // that is at least as restrictive as the assigned tier.
    const finalTier = fallback ? Math.min(assignedTier, 0) : assignedTier;

    return {
      tier: finalTier as 0 | 1 | 2,
      confidence,
      reason: fallback
        ? `Low confidence (${confidence.toFixed(2)} < ${this.policy.threshold}); conservative T0 fallback. Matched: ${matchedRule || 'none'}`
        : `Matched rule: ${matchedRule || 'default'}; tier ${assignedTier}`,
      fallback,
      policyVersion: this.policy.version,
    };
  }
}
