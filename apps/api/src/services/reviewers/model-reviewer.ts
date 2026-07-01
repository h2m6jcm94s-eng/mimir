import { ReviewResult as ReviewResultSchema } from '@mimir/shared-types';
import type { ClassificationTier, ReviewResult } from '@mimir/shared-types';
import { getModelRouter } from '../models/router';
import type { ReviewerAdapter, ReviewerInput } from './router';

function buildReviewerPrompt(input: ReviewerInput): string {
  return `You are a code/design reviewer. Review the draft and return ONLY a raw JSON object with no markdown fences.

Required JSON schema:
{
  "verdict": "approve" | "revise" | "escalate",
  "approved": boolean,
  "reason": string,
  "findings": [{"claim": string, "issue": string, "suggestion": string}],
  "patch": optional RFC 6902 JSON Patch operations
}

Draft type: ${input.type}
Iteration: ${input.iteration}
Draft: ${JSON.stringify(input.draft.artifacts)}
`;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export interface ModelReviewerOptions {
  provider?: string;
  model?: string;
}

export class ModelReviewer implements ReviewerAdapter {
  readonly name = 'model-reviewer';
  readonly tier: ClassificationTier;
  private provider?: string;
  private model?: string;

  constructor(tier: ClassificationTier, options?: ModelReviewerOptions) {
    this.tier = tier;
    this.provider = options?.provider;
    this.model = options?.model;
  }

  async review(input: ReviewerInput): Promise<ReviewResult> {
    const router = getModelRouter();
    const prompt = buildReviewerPrompt(input);

    try {
      const output = await router.invoke(
        this.tier,
        { prompt, payload: {} },
        { provider: this.provider, model: this.model }
      );
      const cleaned = stripMarkdownFences(output.text);
      const parsed = JSON.parse(cleaned);
      return ReviewResultSchema.parse(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        verdict: 'escalate',
        approved: false,
        reason: `Model reviewer failed to produce a valid ReviewResult: ${message}`,
        findings: [],
      };
    }
  }
}
