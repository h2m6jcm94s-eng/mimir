import { type MarketplaceItem, marketplaceItemSchema } from '@mimir/shared-types';

const catalog: MarketplaceItem[] = [
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

export function getMarketplaceCatalog(): MarketplaceItem[] {
  return catalog;
}

export function getMarketplaceItem(id: string): MarketplaceItem | undefined {
  return catalog.find((item) => item.id === id);
}
