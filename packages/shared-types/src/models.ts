import { z } from 'zod';
import { JobStatus, NodeKind, NodeStatus, UserRole } from './enums';

export const Tenant = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  createdAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof Tenant>;

export const User = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  clerkId: z.string(),
  role: UserRole,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const Node = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: NodeKind,
  name: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  tailnetAddr: z.string().optional(),
  status: NodeStatus,
  lastSeen: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Node = z.infer<typeof Node>;

export const Job = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  idempotencyKey: z.string(),
  type: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  status: JobStatus,
  targetNode: z.string().uuid().optional(),
  epoch: z.number().int().default(0),
  checkpoint: z.record(z.unknown()).default({}),
  costUsd: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Job = z.infer<typeof Job>;

export const ReviewVerdict = z.enum(['approve', 'revise', 'escalate']);
export type ReviewVerdict = z.infer<typeof ReviewVerdict>;

export const ReviewFinding = z.object({
  claim: z.string(),
  issue: z.string(),
  suggestion: z.string(),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

export const JsonPatchOperation = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
  path: z.string(),
  value: z.unknown().optional(),
  from: z.string().optional(),
});
export type JsonPatchOperation = z.infer<typeof JsonPatchOperation>;

export const ReviewResult = z.object({
  verdict: ReviewVerdict,
  approved: z.boolean(),
  reason: z.string(),
  findings: z.array(ReviewFinding).default([]),
  patch: z.array(JsonPatchOperation).optional(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

export const ProviderId = z.enum([
  'local',
  'openai',
  'anthropic',
  'kimi',
  'qwen',
  'ollama',
  'groq',
]);
export type ProviderId = z.infer<typeof ProviderId>;

export const ModelUsage = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});
export type ModelUsage = z.infer<typeof ModelUsage>;

export const ModelInput = z.object({
  prompt: z.string(),
  payload: z.record(z.unknown()).default({}),
  model: z.string().optional(),
});
export type ModelInput = z.infer<typeof ModelInput>;

export const ModelOutput = z.object({
  text: z.string(),
  model: z.string(),
  provider: ProviderId,
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  usage: ModelUsage.optional(),
  costUsd: z.number().int().min(0).optional(),
});
export type ModelOutput = z.infer<typeof ModelOutput>;

export const ModelProviderEntry = z.object({
  provider: ProviderId,
  model: z.string().optional(),
  priority: z.number().int().min(0).default(0),
});
export type ModelProviderEntry = z.infer<typeof ModelProviderEntry>;

export const ModelProviderConfig = z.object({
  0: z.array(ModelProviderEntry).default([{ provider: 'local' }]),
  1: z.array(ModelProviderEntry).default([{ provider: 'openai' }]),
  2: z.array(ModelProviderEntry).default([{ provider: 'openai' }]),
});
export type ModelProviderConfig = z.infer<typeof ModelProviderConfig>;
