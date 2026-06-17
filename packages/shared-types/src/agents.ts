import { z } from 'zod';
import { ProviderId } from './models';

export const AgentRoleKind = z.enum([
  'main',
  'planner',
  'reviewer',
  'coder',
  'researcher',
  'memory',
  'executor',
  'fallback',
]);
export type AgentRoleKind = z.infer<typeof AgentRoleKind>;

export const AgentCapability = z.enum([
  'chat',
  'plan',
  'review',
  'code',
  'search',
  'remember',
  'act',
  'cheap',
  'fast',
  'creative',
  'long_context',
  'reasoning',
]);
export type AgentCapability = z.infer<typeof AgentCapability>;

export const AgentRole = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: AgentRoleKind,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  priority: z.number().int().min(0).default(0),
  provider: ProviderId,
  model: z.string().max(255).optional(),
  capabilities: z.array(AgentCapability).default([]),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentRole = z.infer<typeof AgentRole>;

export const AgentRoleInput = z.object({
  kind: AgentRoleKind,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  priority: z.number().int().min(0).default(0),
  provider: ProviderId,
  model: z.string().max(255).optional(),
  capabilities: z.array(AgentCapability).default([]),
  isDefault: z.boolean().default(false),
});
export type AgentRoleInput = z.infer<typeof AgentRoleInput>;

export const AgentResolutionRequest = z.object({
  kind: AgentRoleKind,
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  requiredCapabilities: z.array(AgentCapability).default([]).optional(),
});
export type AgentResolutionRequest = z.infer<typeof AgentResolutionRequest>;

export const AgentResolutionResult = z.object({
  kind: AgentRoleKind,
  roleId: z.string().uuid(),
  name: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  provider: ProviderId,
  model: z.string().optional(),
  capabilities: z.array(AgentCapability),
});
export type AgentResolutionResult = z.infer<typeof AgentResolutionResult>;
