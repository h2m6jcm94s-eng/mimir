import { createHash } from 'node:crypto';
import type { ApprovalBlastRadius, ApprovalRisk } from '@mimir/shared-types';

export const APPROVAL_TIMEOUT_MS: Record<number, number> = {
  0: 60 * 60 * 1000, // T0: 1 hour
  1: 30 * 60 * 1000, // T1: 30 minutes
  2: 10 * 60 * 1000, // T2: 10 minutes
};

export function riskFromTier(tier: number): ApprovalRisk {
  if (tier >= 2) return 'high';
  if (tier === 1) return 'medium';
  return 'low';
}

export function approvalExpiresAt(tier: number, from = new Date()): Date {
  const timeout = APPROVAL_TIMEOUT_MS[tier] ?? APPROVAL_TIMEOUT_MS[0];
  return new Date(from.getTime() + timeout);
}

export function buildBlastRadius(input: {
  tier: number;
  action: string;
  scope?: string;
  estimatedCostUsd?: number;
  dataSubjects?: number;
  connectors?: string[];
  summary?: string;
}): ApprovalBlastRadius {
  return {
    tier: input.tier,
    action: input.action,
    scope: input.scope,
    estimatedCostUsd: input.estimatedCostUsd,
    dataSubjects: input.dataSubjects,
    connectors: input.connectors,
    summary: input.summary,
  };
}

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

export function verifyPin(pin: string | undefined, pinHash: string | null | undefined): boolean {
  if (!pinHash) return true;
  if (typeof pin !== 'string' || pin.length === 0) return false;
  return hashPin(pin) === pinHash;
}
