import type { TenantContext } from '../../db/tenant-context';
import type { ModelInvocationRow } from '../../repositories/model-leaderboard';
import {
  type CreateModelInvocationInput,
  type LeaderboardAgg,
  createModelInvocation,
  getModelLeaderboard,
} from '../../repositories/model-leaderboard';

export function recordModelInvocation(
  ctx: TenantContext,
  input: CreateModelInvocationInput
): Promise<ModelInvocationRow> {
  return createModelInvocation(ctx, input);
}

export function getLeaderboard(ctx: TenantContext, days: number): Promise<LeaderboardAgg[]> {
  return getModelLeaderboard(ctx, days);
}
