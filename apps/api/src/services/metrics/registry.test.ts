import { describe, expect, it } from 'vitest';
import { sanitizeMetricPath } from './registry';

describe('sanitizeMetricPath', () => {
  it('leaves route patterns untouched', () => {
    expect(sanitizeMetricPath('/v1/sessions/:id')).toBe('/v1/sessions/:id');
  });

  it('replaces UUID segments with :id', () => {
    expect(sanitizeMetricPath('/v1/sessions/123e4567-e89b-12d3-a456-426614174000')).toBe(
      '/v1/sessions/:id'
    );
  });

  it('replaces numeric segments with :id', () => {
    expect(sanitizeMetricPath('/v1/tasks/42')).toBe('/v1/tasks/:id');
  });

  it('replaces email segments with :id', () => {
    expect(sanitizeMetricPath('/v1/users/alice@example.com/profile')).toBe('/v1/users/:id/profile');
  });

  it('does not replace version-like numeric prefixes', () => {
    expect(sanitizeMetricPath('/v1/tasks')).toBe('/v1/tasks');
  });

  it('handles root and empty paths', () => {
    expect(sanitizeMetricPath('/')).toBe('/');
    expect(sanitizeMetricPath('')).toBe('');
  });
});
