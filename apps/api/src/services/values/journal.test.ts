import { describe, expect, it } from 'vitest';
import { computeDecisionAlignment } from './journal';

describe('computeDecisionAlignment', () => {
  it('returns 0 when no values are referenced', () => {
    const result = computeDecisionAlignment('Option A', [], []);
    expect(result.score).toBe(0);
    expect(result.rationale).toContain('No values referenced or empty chosen option.');
  });

  it('returns 0 when referenced values do not exist', () => {
    const result = computeDecisionAlignment('Option A', ['missing-id'], []);
    expect(result.score).toBe(0);
    expect(result.rationale).toContain('Referenced values no longer exist.');
  });

  it('matches keywords in value names', () => {
    const values = [
      { id: 'v1', name: 'Health', description: '', weight: 10 },
      { id: 'v2', name: 'Wealth', description: '', weight: 5 },
    ];
    const result = computeDecisionAlignment('I chose the health option', ['v1', 'v2'], values);
    expect(result.score).toBe(67); // 10 / 15 = 0.666...
    expect(result.rationale.some((line) => line.includes('Health'))).toBe(true);
  });

  it('matches keywords in value descriptions', () => {
    const values = [
      { id: 'v1', name: 'Family', description: 'prioritize family time', weight: 8 },
      { id: 'v2', name: 'Career', description: 'advance professional goals', weight: 4 },
    ];
    const result = computeDecisionAlignment('I prioritized time with family', ['v1', 'v2'], values);
    expect(result.score).toBe(67); // 8 / 12
  });

  it('returns 100 when all referenced values match', () => {
    const values = [
      { id: 'v1', name: 'Growth', description: '', weight: 7 },
      { id: 'v2', name: 'Learning', description: '', weight: 3 },
    ];
    const result = computeDecisionAlignment('growth and learning', ['v1', 'v2'], values);
    expect(result.score).toBe(100);
  });

  it('ignores stop words and punctuation', () => {
    const values = [{ id: 'v1', name: 'Health', description: 'be healthy', weight: 5 }];
    const result = computeDecisionAlignment('The healthy, choice!', ['v1'], values);
    expect(result.score).toBe(100);
  });
});
