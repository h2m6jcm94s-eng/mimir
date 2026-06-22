import { type MarketplaceItem, marketplaceItemSchema } from '@mimir/shared-types';
import type { TenantContext } from '../db/tenant-context';
import { listPublishedSkillDrafts } from '../repositories/skills';

const staticCatalog: MarketplaceItem[] = [
  {
    id: 'meeting-notes-pro',
    kind: 'skill',
    status: 'published',
    name: 'Meeting Notes Pro',
    description: 'Auto-format meeting notes, action items, and owner assignments.',
    payload: { icon: 'FileText', tags: ['productivity', 'meetings'] },
    installs: 342,
    priceUsd: 0,
    publishedAt: '2026-01-15T00:00:00Z',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'terminal-copilot',
    kind: 'skill',
    status: 'published',
    name: 'Terminal Copilot',
    description: 'Translate natural language into shell commands and explain outputs.',
    payload: { icon: 'Terminal', tags: ['engineering', 'cli'] },
    installs: 189,
    priceUsd: 0,
    publishedAt: '2026-02-20T00:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'gmail-connector',
    kind: 'connector',
    status: 'published',
    name: 'Gmail Connector',
    description: 'Read and draft emails from your Gmail account with Mimir.',
    payload: { icon: 'Mail', tags: ['email', 'google'] },
    installs: 76,
    priceUsd: 0,
    publishedAt: '2026-03-05T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'figma-connector',
    kind: 'connector',
    status: 'published',
    name: 'Figma Connector',
    description: 'Pull design comments and component metadata into your knowledge base.',
    payload: { icon: 'Figma', tags: ['design', 'engineering'] },
    installs: 54,
    priceUsd: 0,
    publishedAt: '2026-04-10T00:00:00Z',
    createdAt: '2026-04-08T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'cloud-render',
    kind: 'workflow',
    status: 'published',
    name: 'Cloud Render',
    description: 'Trigger renders, notify stakeholders, and archive outputs.',
    payload: { icon: 'Workflow', tags: ['media', 'automation'] },
    installs: 31,
    priceUsd: 9.99,
    publishedAt: '2026-05-12T00:00:00Z',
    createdAt: '2026-05-10T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
].map((i) => marketplaceItemSchema.parse(i));

function skillDraftToMarketplaceItem(draft: {
  id: string;
  name: string;
  description: string;
  payload: unknown;
  installs: number;
  createdAt: Date;
  updatedAt: Date;
}): MarketplaceItem {
  return marketplaceItemSchema.parse({
    id: draft.id,
    kind: 'skill',
    status: 'published',
    name: draft.name,
    description: draft.description,
    payload: draft.payload,
    installs: draft.installs,
    priceUsd: 0,
    publishedAt: draft.updatedAt.toISOString(),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  });
}

export async function getMarketplaceCatalog(ctx: TenantContext): Promise<MarketplaceItem[]> {
  const publishedDrafts = await listPublishedSkillDrafts(ctx);
  return [...staticCatalog, ...publishedDrafts.map(skillDraftToMarketplaceItem)];
}

export async function getMarketplaceItem(
  ctx: TenantContext,
  id: string
): Promise<MarketplaceItem | undefined> {
  const staticItem = staticCatalog.find((item) => item.id === id);
  if (staticItem) return staticItem;

  const draft = await listPublishedSkillDrafts(ctx).then((drafts) =>
    drafts.find((d) => d.id === id)
  );
  if (!draft) return undefined;
  return skillDraftToMarketplaceItem(draft);
}
