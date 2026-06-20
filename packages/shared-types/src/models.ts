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
  userAccountId: z.string().uuid(),
  role: UserRole,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const Node = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  ownerUserAccountId: z.string().uuid().optional(),
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
  input: z.record(z.unknown()).nullable().optional(),
  result: z.record(z.unknown()).nullable().optional(),
  checkpoint: z.record(z.unknown()).default({}),
  costUsd: z.number().default(0),
  priority: z.number().int().default(0),
  retryCount: z.number().int().default(0),
  maxRetries: z.number().int().default(3),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
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

export const LocalModelInfo = z.object({
  name: z.string(),
  size: z.number().int().optional(),
  digest: z.string().optional(),
  modifiedAt: z.string().datetime().optional(),
});
export type LocalModelInfo = z.infer<typeof LocalModelInfo>;

export const LocalModelConfig = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  baseUrl: z.string().url().default('http://localhost:11434'),
  chatModel: z.string().default('llama3.1'),
  embeddingModel: z.string().default('nomic-embed-text'),
  embeddingDimension: z.number().int().min(1).default(768),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LocalModelConfig = z.infer<typeof LocalModelConfig>;

export const UpsertLocalModelConfigRequest = z.object({
  baseUrl: z.string().url(),
  chatModel: z.string().min(1),
  embeddingModel: z.string().min(1),
  embeddingDimension: z.number().int().min(1).default(768),
  enabled: z.boolean().default(true),
});
export type UpsertLocalModelConfigRequest = z.infer<typeof UpsertLocalModelConfigRequest>;

export const LocalModelStatus = z.object({
  reachable: z.boolean(),
  baseUrl: z.string().url(),
  models: z.array(LocalModelInfo),
  chatAvailable: z.boolean(),
  embedAvailable: z.boolean(),
  defaultChatModel: z.string().optional(),
  defaultEmbedModel: z.string().optional(),
  error: z.string().optional(),
});
export type LocalModelStatus = z.infer<typeof LocalModelStatus>;

export const LocalModelListResponse = z.object({
  models: z.array(LocalModelInfo),
});
export type LocalModelListResponse = z.infer<typeof LocalModelListResponse>;

export const PullModelRequest = z.object({
  model: z.string().min(1),
});
export type PullModelRequest = z.infer<typeof PullModelRequest>;

export const PullModelResponse = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'done', 'failed']),
});
export type PullModelResponse = z.infer<typeof PullModelResponse>;
