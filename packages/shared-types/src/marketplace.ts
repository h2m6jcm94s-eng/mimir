import { z } from 'zod';

export const marketplaceItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['skill', 'connector', 'workflow']),
  status: z.enum(['draft', 'published', 'archived']),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  payload: z.record(z.unknown()).default({}),
  installs: z.number().int().min(0).default(0),
  priceUsd: z.number().min(0).default(0),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketplaceInstallSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  itemId: z.string(),
  installedAt: z.string().datetime(),
});

export type MarketplaceItem = z.infer<typeof marketplaceItemSchema>;
export type MarketplaceInstall = z.infer<typeof marketplaceInstallSchema>;
