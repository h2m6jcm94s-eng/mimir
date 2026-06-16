import { z } from 'zod';

export const PrivacyTier = z.enum(['T0', 'T1', 'T2']);
export type PrivacyTier = z.infer<typeof PrivacyTier>;

export const NodeKind = z.enum(['brain', 'desktop', 'cloud', 'phone']);
export type NodeKind = z.infer<typeof NodeKind>;

export const NodeStatus = z.enum(['up', 'degraded', 'down', 'unknown']);
export type NodeStatus = z.infer<typeof NodeStatus>;

export const JobStatus = z.enum([
  'queued',
  'running',
  'blocked',
  'needs_attention',
  'done',
  'failed',
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const UserRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type UserRole = z.infer<typeof UserRole>;
