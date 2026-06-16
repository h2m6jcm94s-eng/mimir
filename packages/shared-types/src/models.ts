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


