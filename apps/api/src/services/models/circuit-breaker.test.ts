import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('starts closed and allows requests', () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen()).toBe(false);
    expect(cb.getState()).toBe('closed');
  });

  it('opens after the configured failure threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
    expect(cb.getState()).toBe('open');
  });

  it('records successes and resets failure count', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
  });

  it('moves to half-open after the recovery timeout', () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 5_000 });
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    vi.advanceTimersByTime(5_000);
    expect(cb.getState()).toBe('half-open');
    expect(cb.isOpen()).toBe(false);

    vi.useRealTimers();
  });

  it('closes again after a success in half-open', () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 5_000 });
    cb.recordFailure();
    vi.advanceTimersByTime(5_000);
    expect(cb.getState()).toBe('half-open');

    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
    expect(cb.isOpen()).toBe(false);

    vi.useRealTimers();
  });

  it('opens again when a failure happens in half-open', () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 5_000 });
    cb.recordFailure();
    vi.advanceTimersByTime(5_000);
    expect(cb.getState()).toBe('half-open');

    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.isOpen()).toBe(true);

    vi.useRealTimers();
  });
});
