import { z } from 'zod';

export const ConnectorKind = z.enum(['github']);
export type ConnectorKind = z.infer<typeof ConnectorKind>;

export const ConnectorStatus = z.enum(['connected', 'disconnected', 'error']);
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

export const ConnectorTier = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type ConnectorTier = z.infer<typeof ConnectorTier>;

export const Connector = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: ConnectorKind,
  account: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  tier: ConnectorTier,
  status: ConnectorStatus,
  secretRef: z.string().optional(),
  lastSync: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Connector = z.infer<typeof Connector>;

export const CreateConnectorRequest = z.object({
  kind: ConnectorKind,
  account: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  tier: ConnectorTier.default(1),
  secretRef: z.string().min(1),
});
export type CreateConnectorRequest = z.infer<typeof CreateConnectorRequest>;

export const ConnectorActionRequest = z.object({
  tier: ConnectorTier.default(1),
  input: z.record(z.unknown()).default({}),
});
export type ConnectorActionRequest = z.infer<typeof ConnectorActionRequest>;

export const GitHubListReposInput = z.object({
  type: z.enum(['all', 'owner', 'member', 'public', 'private']).default('all'),
  perPage: z.number().int().min(1).max(100).default(30),
});
export type GitHubListReposInput = z.infer<typeof GitHubListReposInput>;

export const GitHubIssueInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  issueNumber: z.number().int().min(1),
});
export type GitHubIssueInput = z.infer<typeof GitHubIssueInput>;

export const GitHubPullRequestInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().min(1),
});
export type GitHubPullRequestInput = z.infer<typeof GitHubPullRequestInput>;

export const GitHubIngestFileInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  path: z.string().min(1),
  ref: z.string().optional(),
});
export type GitHubIngestFileInput = z.infer<typeof GitHubIngestFileInput>;

export const GitHubOpenPrInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(''),
  head: z.string().min(1),
  base: z.string().min(1),
});
export type GitHubOpenPrInput = z.infer<typeof GitHubOpenPrInput>;
