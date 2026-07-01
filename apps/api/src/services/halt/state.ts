import { redis } from '../../db/redis';

const HALT_KEY_PREFIX = 'mimir:halt';

function haltKey(tenantId = 'global'): string {
  return `${HALT_KEY_PREFIX}:${tenantId}`;
}

export interface HaltState {
  halted: boolean;
  reason?: string;
  triggeredAt?: string;
  triggeredBy?: string;
}

export class HaltError extends Error {
  constructor(state: HaltState) {
    super(`Emergency halt is active: ${state.reason || 'no reason provided'}`);
    this.name = 'HaltError';
  }
}

export async function isHalted(tenantId?: string): Promise<boolean> {
  try {
    const raw = await redis.get(haltKey(tenantId));
    return raw !== null && raw !== '';
  } catch (err) {
    console.warn('Redis unavailable during halt check; failing safe (not halted)', err);
    return false;
  }
}

export async function getHaltState(tenantId?: string): Promise<HaltState> {
  try {
    const raw = await redis.get(haltKey(tenantId));
    if (!raw) {
      return { halted: false };
    }
    const parsed = JSON.parse(raw) as Omit<HaltState, 'halted'>;
    return { halted: true, ...parsed };
  } catch (err) {
    console.warn('Redis unavailable during halt state read; failing safe (not halted)', err);
    return { halted: false };
  }
}

export async function setHalted(
  reason: string,
  triggeredBy: string,
  tenantId?: string
): Promise<void> {
  const payload: Omit<HaltState, 'halted'> = {
    reason,
    triggeredAt: new Date().toISOString(),
    triggeredBy,
  };
  await redis.set(haltKey(tenantId), JSON.stringify(payload));
}

export async function clearHalt(tenantId?: string): Promise<void> {
  await redis.del(haltKey(tenantId));
}

export async function throwIfHalted(tenantId?: string): Promise<void> {
  const state = await getHaltState(tenantId);
  if (state.halted) {
    throw new HaltError(state);
  }
}
