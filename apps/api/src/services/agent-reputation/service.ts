import type { TenantContext } from '../../db/tenant-context';
import {
  type AgentReputationRow,
  listAgentReputations,
  recordAgentReputationOutcome,
} from '../../repositories/agent-reputation';

export function listReputations(ctx: TenantContext): Promise<AgentReputationRow[]> {
  return listAgentReputations(ctx);
}

export function applyReputationFeedback(
  ctx: TenantContext,
  role: string,
  outcome: 'success' | 'failure'
): Promise<AgentReputationRow> {
  return recordAgentReputationOutcome(ctx, role, outcome);
}
