import { describe, expect, it } from 'vitest';
import { ModelReviewer } from './model-reviewer';

const hasKimiKey = Boolean(process.env.KIMI_API_KEY);
const reviewerProvider = process.env.REVIEWER_PROVIDER;

describe.skipIf(!hasKimiKey || !reviewerProvider)('ModelReviewer integration', () => {
  it('returns a valid ReviewResult for a small draft', async () => {
    const reviewer = new ModelReviewer(1, { provider: reviewerProvider });
    const result = await reviewer.review({
      prompt: 'Review this draft',
      type: 'echo',
      tier: 1,
      draft: { success: true, artifacts: { plan: 'Add pagination to /reports' }, log: [] },
      iteration: 0,
    });

    expect(['approve', 'revise', 'escalate']).toContain(result.verdict);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(typeof result.approved).toBe('boolean');
    expect(Array.isArray(result.findings)).toBe(true);
  }, 30_000);
});
