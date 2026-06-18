import { describe, expect, it } from 'vitest';
import { PolicyTranslationError, translatePolicy } from './translator';

describe('translatePolicy', () => {
  it('translates "require approval for github.openPr"', async () => {
    const source = await translatePolicy('Require approval for github.openPr');
    expect(source).toContain('action: "github.openPr"');
    expect(source).toContain('effect: require_approval');
  });

  it('translates a tier-based deny rule', async () => {
    const source = await translatePolicy('Deny tier 2 actions');
    expect(source).toContain('effect: deny');
    expect(source).toContain('tier: 2');
  });

  it('translates a daily spend deny rule', async () => {
    const source = await translatePolicy('Deny when daily spend is greater than 5.00');
    expect(source).toContain('effect: deny');
    expect(source).toContain("dailySpendUsd: '> 5.00'");
  });

  it('falls back to the model invoker when heuristic does not match', async () => {
    const source = await translatePolicy('something exotic', {
      invokeModel: async () => ({
        text: '```yaml\nrules:\n  - action: "*"\n    effect: allow\n```',
        model: 'local',
        provider: 'local',
        tier: 1 as const,
      }),
    });
    expect(source).toContain('action: "*"');
    expect(source).toContain('effect: allow');
  });

  it('throws when nothing matches and no model invoker is provided', async () => {
    await expect(translatePolicy('just some unrelated text')).rejects.toBeInstanceOf(
      PolicyTranslationError
    );
  });

  it('throws when the model returns invalid yaml', async () => {
    await expect(
      translatePolicy('bad input', {
        invokeModel: async () => ({
          text: 'not yaml',
          model: 'local',
          provider: 'local',
          tier: 1 as const,
        }),
      })
    ).rejects.toBeInstanceOf(PolicyTranslationError);
  });
});
