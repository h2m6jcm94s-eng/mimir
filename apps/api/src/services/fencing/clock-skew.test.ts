import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClockSkewError,
  assertNoClockSkew,
  checkClockSkew,
  getClockSkewThresholdMs,
  resetClockSkewState,
} from './clock-skew';

function mockClocks(wallMs: number, monoMs: number) {
  vi.spyOn(Date, 'now').mockReturnValue(wallMs);
  vi.spyOn(process.hrtime, 'bigint').mockReturnValue(BigInt(monoMs) * 1_000_000n);
}

describe('clock-skew guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetClockSkewState();
  });

  it('uses default threshold', () => {
    expect(getClockSkewThresholdMs()).toBe(5000);
  });

  it('allows env override', () => {
    vi.stubEnv('CLOCK_SKEW_THRESHOLD_MS', '10000');
    expect(getClockSkewThresholdMs()).toBe(10000);
  });

  it('falls back to default for invalid override', () => {
    vi.stubEnv('CLOCK_SKEW_THRESHOLD_MS', 'abc');
    expect(getClockSkewThresholdMs()).toBe(5000);
    vi.stubEnv('CLOCK_SKEW_THRESHOLD_MS', '50');
    expect(getClockSkewThresholdMs()).toBe(5000);
  });

  it('reports no skew on first check', () => {
    mockClocks(1000, 1000);
    const state = checkClockSkew();
    expect(state.ok).toBe(true);
    expect(state.skewMs).toBe(0);
  });

  it('stays ok when wall and monotonic clocks advance together', () => {
    mockClocks(1000, 1000);
    checkClockSkew();
    mockClocks(2000, 2000);
    const state = checkClockSkew();
    expect(state.ok).toBe(true);
    expect(state.skewMs).toBe(0);
  });

  it('detects backward wall-clock jump', () => {
    mockClocks(10_000, 10_000);
    checkClockSkew();
    mockClocks(1000, 11_000); // wall jumped back, mono advanced 1s
    const state = checkClockSkew();
    expect(state.ok).toBe(false);
    expect(state.skewMs).toBe(10000);
  });

  it('detects forward wall-clock jump', () => {
    mockClocks(1000, 1000);
    checkClockSkew();
    mockClocks(10_000, 2000); // wall jumped forward, mono advanced 1s
    const state = checkClockSkew();
    expect(state.ok).toBe(false);
    expect(state.skewMs).toBe(8000);
  });

  it('throws ClockSkewError when skew is detected', () => {
    mockClocks(1000, 1000);
    checkClockSkew();
    mockClocks(10_000, 2000);
    expect(() => assertNoClockSkew('test-context')).toThrow(ClockSkewError);
  });
});
