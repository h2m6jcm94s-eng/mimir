import { z } from 'zod';

export const ValueStatement = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  appUserId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  weight: z.number().int().min(1).max(10).default(5),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ValueStatement = z.infer<typeof ValueStatement>;

export const CreateValueStatementRequest = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(''),
  weight: z.number().int().min(1).max(10).default(5),
});
export type CreateValueStatementRequest = z.infer<typeof CreateValueStatementRequest>;

export const UpdateValueStatementRequest = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  weight: z.number().int().min(1).max(10).optional(),
});
export type UpdateValueStatementRequest = z.infer<typeof UpdateValueStatementRequest>;

export const ValueStatementListResponse = z.object({
  data: z.array(ValueStatement),
});
export type ValueStatementListResponse = z.infer<typeof ValueStatementListResponse>;

export const DecisionOption = z.object({
  label: z.string().min(1),
  description: z.string().default(''),
});
export type DecisionOption = z.infer<typeof DecisionOption>;

export const Decision = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  appUserId: z.string().uuid(),
  title: z.string().min(1),
  context: z.string().default(''),
  options: z.array(DecisionOption).default([]),
  chosenOption: z.string().min(1),
  valueIds: z.array(z.string().uuid()).default([]),
  decidedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Decision = z.infer<typeof Decision>;

export const CreateDecisionRequest = z.object({
  title: z.string().min(1).max(255),
  context: z.string().max(5000).default(''),
  options: z.array(DecisionOption).min(2).default([]),
  chosenOption: z.string().min(1),
  valueIds: z.array(z.string().uuid()).default([]),
  decidedAt: z.string().datetime().optional(),
});
export type CreateDecisionRequest = z.infer<typeof CreateDecisionRequest>;

export const DecisionListResponse = z.object({
  data: z.array(Decision),
});
export type DecisionListResponse = z.infer<typeof DecisionListResponse>;

export const DecisionOutcome = z.object({
  id: z.string().uuid(),
  decisionId: z.string().uuid(),
  outcome: z.string().min(1),
  alignmentScore: z.number().int().min(1).max(10).optional(),
  notes: z.string().default(''),
  recordedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type DecisionOutcome = z.infer<typeof DecisionOutcome>;

export const CreateDecisionOutcomeRequest = z.object({
  outcome: z.string().min(1).max(5000),
  alignmentScore: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000).default(''),
});
export type CreateDecisionOutcomeRequest = z.infer<typeof CreateDecisionOutcomeRequest>;

export const DecisionOutcomeListResponse = z.object({
  data: z.array(DecisionOutcome),
});
export type DecisionOutcomeListResponse = z.infer<typeof DecisionOutcomeListResponse>;

export const DecisionAlignmentResponse = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.array(z.string()),
});
export type DecisionAlignmentResponse = z.infer<typeof DecisionAlignmentResponse>;
