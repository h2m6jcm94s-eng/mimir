import { describe, expect, it } from 'vitest';
import { PolicyEngine } from './engine';

const demoPolicy = `
rules:
  - action: github.openPr
    effect: require_approval
    reason: opening a PR requires human approval
  - action: '*'
    effect: deny
    when:
      tier: 2
      dailySpendUsd: '> 1.00'
    reason: daily cloud spend limit exceeded
  - action: '*'
    effect: allow
`;

describe('PolicyEngine', () => {
  it('defaults to allow when no rules match', () => {
    const engine = new PolicyEngine('rules: []');
    const decision = engine.evaluate({ action: 'anything', tier: 1, dailySpendUsd: 0 });
    expect(decision.effect).toBe('allow');
  });

  it('requires approval for github.openPr', () => {
    const engine = new PolicyEngine(demoPolicy);
    const decision = engine.evaluate({ action: 'github.openPr', tier: 1, dailySpendUsd: 0 });
    expect(decision.effect).toBe('require_approval');
    expect(decision.reason).toContain('human approval');
  });

  it('denies tier-2 actions when daily spend exceeds threshold', () => {
    const engine = new PolicyEngine(demoPolicy);
    const decision = engine.evaluate({ action: 'summarize', tier: 2, dailySpendUsd: 2 });
    expect(decision.effect).toBe('deny');
    expect(decision.reason).toContain('daily cloud spend limit');
  });

  it('allows tier-2 actions when daily spend is under threshold', () => {
    const engine = new PolicyEngine(demoPolicy);
    const decision = engine.evaluate({ action: 'summarize', tier: 2, dailySpendUsd: 0.5 });
    expect(decision.effect).toBe('allow');
  });

  it('matches wildcard action', () => {
    const engine = new PolicyEngine(demoPolicy);
    const decision = engine.evaluate({ action: 'some.task', tier: 2, dailySpendUsd: 2 });
    expect(decision.effect).toBe('deny');
  });

  it('supports kind matching', () => {
    const policy = `
rules:
  - action: '*'
    effect: deny
    when:
      kind: github
    reason: github is disabled
`;
    const engine = new PolicyEngine(policy);
    expect(
      engine.evaluate({ action: 'listRepos', kind: 'github', tier: 1, dailySpendUsd: 0 }).effect
    ).toBe('deny');
    expect(
      engine.evaluate({ action: 'listRepos', kind: 'mail', tier: 1, dailySpendUsd: 0 }).effect
    ).toBe('allow');
  });

  it('denies when policy is invalid yaml', () => {
    const engine = new PolicyEngine('rules: [invalid');
    const decision = engine.evaluate({ action: 'x', tier: 1, dailySpendUsd: 0 });
    expect(decision.effect).toBe('deny');
    expect(decision.reason).toContain('Invalid policy');
  });
});
