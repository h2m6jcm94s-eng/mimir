import { redis } from '../../db/redis';

const HALT_KEY = 'mimir:halt';

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

export async function isHalted(): Promise<boolean> {
  try {
    const raw = await redis.get(HALT_KEY);
    return raw !== null && raw !== '';
  } catch (err) {
    console.warn('Redis unavailable during halt check; failing safe (not halted)', err);
    return false;
  }
}

export async function getHaltState(): Promise<HaltState> {
  try {
    const raw = await redis.get(HALT_KEY);
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

export async function setHalted(reason: string, triggeredBy: string): Promise<void> {
  const payload: Omit<HaltState, 'halted'> = {
    reason,
    triggeredAt: new Date().toISOString(),
    triggeredBy,
  };
  await redis.set(HALT_KEY, JSON.stringify(payload));
}

export async function clearHalt(): Promise<void> {
  await redis.del(HALT_KEY);
}

export async function throwIfHalted(): Promise<void> {
  const state = await getHaltState();
  if (state.halted) {
    throw new HaltError(state);
  }
}
