/**
 * Clock-skew guard for fencing operations.
 *
 * Fencing decisions (epoch bumps, promotion leases) rely on wall-clock timestamps
 * (lease expiry, last_seen). A node whose wall clock jumps forward or backward can
 * cause premature failover or lease overlap. We compare the system monotonic clock
 * with the wall clock on every fencing operation; if the delta changes by more than
 * the configured threshold, we reject fencing writes until the skew is resolved.
 */

export class ClockSkewError extends Error {
  constructor(message = 'Clock skew detected: fencing operation rejected') {
    super(message);
    this.name = 'ClockSkewError';
  }
}

export interface ClockSkewState {
  ok: boolean;
  skewMs: number;
  thresholdMs: number;
}

let lastWallMs = 0;
let lastMonoMs = 0;
let skewDetected = false;
let skewDetectedAt: Date | undefined;

export function getClockSkewThresholdMs(): number {
  const raw = process.env.CLOCK_SKEW_THRESHOLD_MS;
  if (!raw) return 5000;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 100) return 5000;
  return parsed;
}

function getWallMs(): number {
  return Date.now();
}

function getMonoMs(): number {
  // process.hrtime.bigint() is monotonic and not subject to system clock changes.
  return Number(process.hrtime.bigint() / 1_000_000n);
}

export function resetClockSkewState(): void {
  lastWallMs = 0;
  lastMonoMs = 0;
  skewDetected = false;
  skewDetectedAt = undefined;
}

export function checkClockSkew(): ClockSkewState {
  const thresholdMs = getClockSkewThresholdMs();
  const wallMs = getWallMs();
  const monoMs = getMonoMs();

  if (lastWallMs === 0) {
    lastWallMs = wallMs;
    lastMonoMs = monoMs;
    return { ok: true, skewMs: 0, thresholdMs };
  }

  const elapsedWall = wallMs - lastWallMs;
  const elapsedMono = monoMs - lastMonoMs;
  const skewMs = Math.abs(elapsedWall - elapsedMono);

  lastWallMs = wallMs;
  lastMonoMs = monoMs;

  if (skewMs > thresholdMs) {
    skewDetected = true;
    skewDetectedAt = new Date();
  }

  return { ok: !skewDetected, skewMs, thresholdMs };
}

export function isSkewDetected(): boolean {
  return skewDetected;
}

export function getSkewDetectedAt(): Date | undefined {
  return skewDetectedAt;
}

export function assertNoClockSkew(context: string): void {
  const state = checkClockSkew();
  if (!state.ok) {
    throw new ClockSkewError(
      `${context}: clock skew ${state.skewMs}ms exceeds threshold ${state.thresholdMs}ms`
    );
  }
}
