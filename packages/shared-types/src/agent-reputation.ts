import { z } from 'zod';

export const AgentReputationOutcome = z.enum(['success', 'failure']);
export type AgentReputationOutcome = z.infer<typeof AgentReputationOutcome>;

export const AgentReputationFeedbackRequest = z.object({
  outcome: AgentReputationOutcome,
});
export type AgentReputationFeedbackRequest = z.infer<typeof AgentReputationFeedbackRequest>;

export const AgentReputation = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: z.string(),
  score: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  lastUpdatedAt: z.string().datetime(),
});
export type AgentReputation = z.infer<typeof AgentReputation>;

export const AgentReputationListResponse = z.object({
  data: z.array(AgentReputation),
});
export type AgentReputationListResponse = z.infer<typeof AgentReputationListResponse>;
