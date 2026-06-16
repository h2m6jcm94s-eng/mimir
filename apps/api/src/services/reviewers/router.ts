import type {
  ClassificationTier,
  JsonPatchOperation,
  ReviewFinding,
  ReviewResult,
} from '@mimir/shared-types';
import { ModelReviewer } from './model-reviewer';

export interface ReviewerDraft {
  success: boolean;
  artifacts: Record<string, unknown>;
  log: string[];
}

export interface ReviewerInput {
  prompt: string;
  type: string;
  tier: ClassificationTier;
  draft: ReviewerDraft;
  iteration: number;
}

export interface ReviewerAdapter {
  readonly name: string;
  readonly tier: ClassificationTier;
  review(input: ReviewerInput): Promise<ReviewResult>;
}

function finding(claim: string, issue: string, suggestion: string): ReviewFinding {
  return { claim, issue, suggestion };
}

function approve(reason: string): ReviewResult {
  return { verdict: 'approve', approved: true, reason, findings: [] };
}

function revise(
  reason: string,
  patch: JsonPatchOperation[],
  findings: ReviewFinding[] = []
): ReviewResult {
  return { verdict: 'revise', approved: false, reason, findings, patch };
}

function escalate(reason: string, findings: ReviewFinding[] = []): ReviewResult {
  return { verdict: 'escalate', approved: false, reason, findings };
}

class LocalReviewer implements ReviewerAdapter {
  readonly name = 'local-reviewer';
  readonly tier = 0 as ClassificationTier;

  async review(input: ReviewerInput): Promise<ReviewResult> {
    if (input.type === 'cycle') {
      return revise('requesting a no-op revision to force cycle detection', [
        { op: 'replace', path: '/noop', value: true },
      ]);
    }
    if (input.type === 'escalate') {
      return escalate('reviewer escalated for human review');
    }
    if (input.type === 'revise-once' && input.iteration === 0) {
      return revise('add a required revision marker', [
        { op: 'add', path: '/revised', value: true },
      ]);
    }
    return approve(`local reviewer approved on iteration ${input.iteration}`);
  }
}

class SelfHostedReviewer implements ReviewerAdapter {
  readonly name = 'self-hosted-reviewer';
  readonly tier = 1 as ClassificationTier;

  async review(input: ReviewerInput): Promise<ReviewResult> {
    if (input.type === 'cycle') {
      return revise('requesting a no-op revision to force cycle detection', [
        { op: 'replace', path: '/noop', value: true },
      ]);
    }
    if (input.type === 'escalate') {
      return escalate('reviewer escalated for human review');
    }
    if (input.type === 'revise-once' && input.iteration === 0) {
      return revise('add a required revision marker', [
        { op: 'add', path: '/revised', value: true },
      ]);
    }
    return approve(`self-hosted reviewer approved on iteration ${input.iteration}`);
  }
}

class CloudReviewer implements ReviewerAdapter {
  readonly name = 'cloud-reviewer';
  readonly tier = 2 as ClassificationTier;

  async review(input: ReviewerInput): Promise<ReviewResult> {
    if (input.type === 'cycle') {
      return revise('requesting a no-op revision to force cycle detection', [
        { op: 'replace', path: '/noop', value: true },
      ]);
    }
    if (input.type === 'escalate') {
      return escalate('reviewer escalated for human review');
    }
    if (input.type === 'revise-once' && input.iteration === 0) {
      return revise('add a required revision marker', [
        { op: 'add', path: '/revised', value: true },
      ]);
    }
    return approve(`cloud reviewer approved on iteration ${input.iteration}`);
  }
}

export interface ReviewerRouterOptions {
  provider?: string;
  model?: string;
}

export class ReviewerRouter {
  private adapters: Record<number, ReviewerAdapter>;

  constructor(options?: ReviewerRouterOptions) {
    const provider = options?.provider ?? process.env.REVIEWER_PROVIDER;
    const model = options?.model ?? process.env.REVIEWER_MODEL;

    this.adapters = {
      0: new LocalReviewer(),
      1: provider
        ? new ModelReviewer(1 as ClassificationTier, { provider, model })
        : new SelfHostedReviewer(),
      2: provider
        ? new ModelReviewer(2 as ClassificationTier, { provider, model })
        : new CloudReviewer(),
    };
  }

  route(tier: ClassificationTier): ReviewerAdapter {
    return this.adapters[tier] ?? this.adapters[0];
  }

  async review(input: ReviewerInput): Promise<ReviewResult> {
    const adapter = this.route(input.tier);
    return adapter.review(input);
  }
}
