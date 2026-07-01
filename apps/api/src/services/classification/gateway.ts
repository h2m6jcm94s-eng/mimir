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
  version: '1.1',
  threshold: DEFAULT_CLASSIFICATION_THRESHOLD,
  rules: [
    {
      name: 'pii_or_secrets',
      tier: 0,
      patterns: [
        // SSN-like
        /\b\d{3}-\d{2}-\d{4}\b/gi,
        // Credit-card-like (16 digits with optional separators)
        /\b(?:\d[ -]*?){13,16}\b/gi,
        // Secret keywords
        /password|secret|token|api[_-]?key|private[_-]?key|passwd|pwd/gi,
        // PII identifiers
        /ssn|social security|passport|credit card|bank account|routing number/gi,
        // Private key / credential file names and MIME types
        /\.(pem|key|p12|pfx|env|keystore|jks)\b/gi,
        /application\/x-pkcs12|application\/x-pem-file|application\/x-x509-ca-cert/gi,
      ],
      weight: 1.0,
    },
    {
      name: 'proprietary_code',
      tier: 0,
      patterns: [
        /proprietary|confidential|internal only|do not share|classified/gi,
        /class \w+ extends|function \w+\(|def \w+\(|const \w+\s*=\s*require\(/g,
      ],
      weight: 0.6,
    },
    {
      name: 'local_compute',
      tier: 1,
      patterns: [
        /\b(render|transcode|encode|compile|build|package|train\s+model|fine[_-]?tune)\b/gi,
        /\brun\s+(this|it)\s+(on\s+my\s+desktop|on\s+the\s+desktop|locally|on\s+ollama)\b/gi,
        /\bollama\b/gi,
      ],
      weight: 0.7,
    },
    {
      name: 'public_task',
      tier: 2,
      patterns: [
        /\b(summarize this public article|check the weather|public page|news|wikipedia)\b/gi,
      ],
      weight: 0.4,
    },
  ],
};

let sharedClassificationGateway: ClassificationGateway | undefined;

export function getClassificationGateway(): ClassificationGateway {
  if (!sharedClassificationGateway) {
    sharedClassificationGateway = new ClassificationGateway();
  }
  return sharedClassificationGateway;
}

export class ClassificationGateway {
  constructor(private readonly policy: ClassificationPolicy = DEFAULT_POLICY) {}

  classify(request: ClassificationRequest): ClassificationResult {
    const text = [
      request.prompt,
      ...request.retrievedContext,
      ...request.attachments.map((a) => [a.name, a.contentType].join(' ')),
    ].join(' ');

    let score = 0;
    let matchedRule: string | undefined;
    let assignedTier: 0 | 1 | 2 = 1; // default to local compute
    const signals: string[] = [];

    for (const rule of this.policy.rules) {
      const matches = rule.patterns.reduce((count, pattern) => {
        return count + (text.match(pattern)?.length || 0);
      }, 0);

      if (matches > 0) {
        signals.push(`${rule.name}=${matches}`);
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

    // Conservative fallback: when in doubt, route to the most private tier.
    const finalTier = fallback ? (Math.min(assignedTier, 0) as 0 | 1 | 2) : assignedTier;

    return {
      tier: finalTier,
      confidence,
      reason: fallback
        ? `Low confidence (${confidence.toFixed(2)} < ${this.policy.threshold}); conservative T0 fallback. Matched: ${matchedRule || 'none'}`
        : `Matched rule: ${matchedRule || 'default'}; tier ${assignedTier}`,
      fallback,
      policyVersion: this.policy.version,
      assignedTier,
      matchedRule: matchedRule ?? (signals.length === 0 ? 'default' : undefined),
      signals,
    };
  }
}
