import { describe, expect, it } from 'vitest';
import { ReviewerRouter } from './router';

function makeInput(overrides: { type?: string; tier?: 0 | 1 | 2; iteration?: number } = {}) {
  return {
    prompt: 'test',
    type: overrides.type ?? 'echo',
    tier: overrides.tier ?? 0,
    draft: { success: true, artifacts: { plan: 'plan' }, log: [] },
    iteration: overrides.iteration ?? 0,
  };
}

describe('ReviewerRouter', () => {
  const router = new ReviewerRouter();

  it('approves by default', async () => {
    const result = await router.review(makeInput());
    expect(result.verdict).toBe('approve');
    expect(result.approved).toBe(true);
  });

  it('routes tier 0 to the local reviewer', async () => {
    const result = await router.review(makeInput({ tier: 0 }));
    expect(result.reason).toContain('local');
  });

  it('routes tier 1 to the self-hosted reviewer', async () => {
    const result = await router.review(makeInput({ tier: 1 }));
    expect(result.reason).toContain('self-hosted');
  });

  it('routes tier 2 to the cloud reviewer', async () => {
    const result = await router.review(makeInput({ tier: 2 }));
    expect(result.reason).toContain('cloud');
  });

  it('requests a revision for revise-once on iteration 0', async () => {
    const result = await router.review(makeInput({ type: 'revise-once', iteration: 0 }));
    expect(result.verdict).toBe('revise');
    expect(result.patch).toHaveLength(1);
  });

  it('approves revise-once after iteration 0', async () => {
    const result = await router.review(makeInput({ type: 'revise-once', iteration: 1 }));
    expect(result.verdict).toBe('approve');
  });

  it('escalates for escalate type', async () => {
    const result = await router.review(makeInput({ type: 'escalate' }));
    expect(result.verdict).toBe('escalate');
  });
});
