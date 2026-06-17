import { z } from 'zod';

export const PolicyEffect = z.enum(['allow', 'deny', 'require_approval']);
export type PolicyEffect = z.infer<typeof PolicyEffect>;

export const PolicyCondition = z.object({
  action: z.string().optional(),
  kind: z.string().optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  dailySpendUsd: z.string().optional(),
});
export type PolicyCondition = z.infer<typeof PolicyCondition>;

export const PolicyRule = z.object({
  action: z.string().optional(),
  kind: z.string().optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  effect: PolicyEffect,
  reason: z.string().optional(),
  when: PolicyCondition.optional(),
});
export type PolicyRule = z.infer<typeof PolicyRule>;

export const PolicyDocument = z.object({
  rules: z.array(PolicyRule).default([]),
});
export type PolicyDocument = z.infer<typeof PolicyDocument>;

export const Policy = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  source: z.string(),
  version: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Policy = z.infer<typeof Policy>;

export const UpsertPolicyRequest = z.object({
  name: z.string().min(1).optional(),
  source: z.string().min(1),
});
export type UpsertPolicyRequest = z.infer<typeof UpsertPolicyRequest>;

export const PolicyDecision = z.object({
  effect: PolicyEffect,
  reason: z.string().optional(),
  rule: PolicyRule.optional(),
});
export type PolicyDecision = z.infer<typeof PolicyDecision>;

export const EvaluatePolicyRequest = z.object({
  action: z.string(),
  tier: z.number().int().min(0).max(2),
  kind: z.string().optional(),
  dailySpendUsd: z.number().default(0),
});
export type EvaluatePolicyRequest = z.infer<typeof EvaluatePolicyRequest>;

export const ApprovalStatus = z.enum(['pending', 'approved', 'denied']);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const Approval = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: ApprovalStatus,
  requestedBy: z.string(),
  decidedBy: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Approval = z.infer<typeof Approval>;

export const DecideApprovalRequest = z.object({
  reason: z.string().optional(),
});
export type DecideApprovalRequest = z.infer<typeof DecideApprovalRequest>;
