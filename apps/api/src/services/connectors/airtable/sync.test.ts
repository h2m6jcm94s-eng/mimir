import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../../db/tenant-context';
import { computeContentHash } from '../../knowledge/ingest';
import { recordContent, syncAirtableTable } from './sync';

const mocks = vi.hoisted(() => ({
  AirtableClient: vi.fn(),
  findConnectorByKind: vi.fn(),
  updateConnector: vi.fn(),
  findKnowledgeItemByUri: vi.fn(),
  createKnowledgeItem: vi.fn(),
  updateKnowledgeItem: vi.fn(),
  deleteEmbeddingsByKnowledgeItemId: vi.fn(),
  createEmbeddings: vi.fn(),
  generateEmbeddingForTier: vi.fn().mockResolvedValue(Array(768).fill(0)),
}));

vi.mock('./client', () => ({
  AirtableClient: mocks.AirtableClient,
}));

vi.mock('../../../repositories/connector', () => ({
  findConnectorByKind: mocks.findConnectorByKind,
  updateConnector: mocks.updateConnector,
}));

vi.mock('../../../repositories/knowledge', () => ({
  findKnowledgeItemByUri: mocks.findKnowledgeItemByUri,
  createKnowledgeItem: mocks.createKnowledgeItem,
  updateKnowledgeItem: mocks.updateKnowledgeItem,
  deleteEmbeddingsByKnowledgeItemId: mocks.deleteEmbeddingsByKnowledgeItemId,
  createEmbeddings: mocks.createEmbeddings,
}));

vi.mock('../../knowledge/ingest', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    generateEmbeddingForTier: mocks.generateEmbeddingForTier,
  };
});

function ctx(): TenantContext {
  return { tenantId: 'tenant-1' } as TenantContext;
}

function setupListAllRecords(
  records: { id: string; createdTime: string; fields: Record<string, unknown> }[]
) {
  mocks.AirtableClient.mockImplementation(() => ({
    listAllRecords: async function* () {
      for (const record of records) {
        yield record;
      }
    },
  }));
}

describe('syncAirtableTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConnectorByKind.mockResolvedValue({
      id: 'conn-1',
      kind: 'airtable',
      tier: 1,
      secretRef: 'airtable',
      status: 'connected',
    });
    mocks.updateConnector.mockResolvedValue({ id: 'conn-1' });
    mocks.createKnowledgeItem.mockResolvedValue({ id: 'item-1' });
    mocks.updateKnowledgeItem.mockResolvedValue({ id: 'item-1' });
  });

  it('ingests new records and updates lastSync', async () => {
    const records = [
      { id: 'rec-1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'A' } },
      { id: 'rec-2', createdTime: '2024-01-02T00:00:00.000Z', fields: { Name: 'B' } },
    ];
    setupListAllRecords(records);
    mocks.findKnowledgeItemByUri.mockResolvedValue(undefined);

    const result = await syncAirtableTable(
      ctx(),
      { tenantId: 'tenant-1', kind: 'airtable', account: null, secretRef: 'airtable' },
      {
        baseId: 'base-1',
        tableId: 'table-1',
        maxRecords: 100,
      }
    );

    expect(result.applied).toBe(true);
    expect(result.output).toMatchObject({
      ingested: 2,
      updated: 0,
      skipped: 0,
      baseId: 'base-1',
      tableId: 'table-1',
    });
    expect(mocks.createKnowledgeItem).toHaveBeenCalledTimes(2);
    expect(mocks.updateConnector).toHaveBeenCalledWith(
      expect.anything(),
      'conn-1',
      expect.objectContaining({ lastSync: expect.any(Date) })
    );
  });

  it('skips records whose content hash has not changed', async () => {
    const record = { id: 'rec-1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'A' } };
    const content = recordContent('base-1', 'table-1', record);
    const hash = computeContentHash(content);

    setupListAllRecords([record]);
    mocks.findKnowledgeItemByUri.mockResolvedValue({ id: 'item-1', hash });

    const result = await syncAirtableTable(
      ctx(),
      { tenantId: 'tenant-1', kind: 'airtable', account: null, secretRef: 'airtable' },
      {
        baseId: 'base-1',
        tableId: 'table-1',
        maxRecords: 100,
      }
    );

    expect(result.output).toMatchObject({ ingested: 0, updated: 0, skipped: 1 });
    expect(mocks.createKnowledgeItem).not.toHaveBeenCalled();
    expect(mocks.updateKnowledgeItem).not.toHaveBeenCalled();
  });

  it('updates existing records when content hash changed', async () => {
    const record = { id: 'rec-1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'A' } };
    setupListAllRecords([record]);
    mocks.findKnowledgeItemByUri.mockResolvedValue({ id: 'item-1', hash: 'old-hash' });

    const result = await syncAirtableTable(
      ctx(),
      { tenantId: 'tenant-1', kind: 'airtable', account: null, secretRef: 'airtable' },
      {
        baseId: 'base-1',
        tableId: 'table-1',
        maxRecords: 100,
      }
    );

    expect(result.output).toMatchObject({ ingested: 0, updated: 1, skipped: 0 });
    expect(mocks.updateKnowledgeItem).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
      expect.objectContaining({ content: expect.any(String), hash: expect.any(String) })
    );
    expect(mocks.deleteEmbeddingsByKnowledgeItemId).toHaveBeenCalledWith(
      expect.anything(),
      'item-1'
    );
    expect(mocks.createEmbeddings).toHaveBeenCalled();
  });

  it('returns not applied when airtable connector is missing', async () => {
    mocks.findConnectorByKind.mockResolvedValue(undefined);

    const result = await syncAirtableTable(
      ctx(),
      { tenantId: 'tenant-1', kind: 'airtable', account: null, secretRef: 'airtable' },
      {
        baseId: 'base-1',
        tableId: 'table-1',
        maxRecords: 100,
      }
    );

    expect(result.applied).toBe(false);
    expect(result.reason).toContain('not configured');
    expect(mocks.updateConnector).not.toHaveBeenCalled();
  });
});
