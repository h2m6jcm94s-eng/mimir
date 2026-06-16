import { describe, expect, it } from 'vitest';
import { computeCostUsd, getModelPrice } from './pricing';

describe('pricing', () => {
  it('returns known model prices', () => {
    expect(getModelPrice('gpt-4o-mini')).toEqual({ prompt: 0.15, completion: 0.6 });
    expect(getModelPrice('moonshot-v1-8k')).toEqual({ prompt: 0.5, completion: 0.5 });
    expect(getModelPrice('claude-3-5-sonnet')).toEqual({ prompt: 3.0, completion: 12.0 });
  });

  it('returns zero prices for unknown models', () => {
    expect(getModelPrice('unknown-model')).toEqual({ prompt: 0, completion: 0 });
  });

  it('computes cost in micro-dollars', () => {
    // gpt-4o-mini: $0.15 / 1M prompt + $0.60 / 1M completion
    // 2M prompt + 1M completion = 0.30 + 0.60 = 0.90 USD = 900_000 micros
    const cost = computeCostUsd('gpt-4o-mini', 2_000_000, 1_000_000);
    expect(cost).toBe(900_000);
  });

  it('rounds to the nearest micro-dollar', () => {
    const cost = computeCostUsd('gpt-4o-mini', 1, 1);
    // (1 / 1_000_000) * 0.15 = 0.00000015 USD
    // (1 / 1_000_000) * 0.60 = 0.00000060 USD
    // total = 0.00000075 USD -> 0.75 micros -> rounds to 1
    expect(cost).toBe(1);
  });
});
