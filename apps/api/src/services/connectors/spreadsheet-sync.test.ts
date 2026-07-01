import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import { convertSheetValuesToRows, syncTabularRows } from './spreadsheet-sync';

const mocks = vi.hoisted(() => ({
  findKnowledgeItemByUri: vi.fn(),
  createKnowledgeItem: vi.fn(),
  updateKnowledgeItem: vi.fn(),
  deleteEmbeddingsByKnowledgeItemId: vi.fn(),
  createEmbeddings: vi.fn(),
  generateEmbeddingForTier: vi.fn().mockResolvedValue(Array(768).fill(0)),
}));

vi.mock('../../repositories/knowledge', () => ({
  findKnowledgeItemByUri: mocks.findKnowledgeItemByUri,
  createKnowledgeItem: mocks.createKnowledgeItem,
  updateKnowledgeItem: mocks.updateKnowledgeItem,
  deleteEmbeddingsByKnowledgeItemId: mocks.deleteEmbeddingsByKnowledgeItemId,
  createEmbeddings: mocks.createEmbeddings,
}));

vi.mock('../knowledge/ingest', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    generateEmbeddingForTier: mocks.generateEmbeddingForTier,
  };
});

function ctx(): TenantContext {
  return { tenantId: 'tenant-1' } as TenantContext;
}

function connector(overrides?: Partial<{ tier: number }>): typeof schema.connector.$inferSelect {
  return {
    id: 'conn-1',
    kind: 'csv',
    tier: overrides?.tier ?? 1,
    secretRef: 'csv',
    status: 'connected',
  } as unknown as typeof schema.connector.$inferSelect;
}

describe('convertSheetValuesToRows', () => {
  it('uses the first row as headers when all cells are non-empty strings', () => {
    const values = [
      ['Name', 'Age'],
      ['Alice', 30],
      ['Bob', 25],
    ];

    const rows = convertSheetValuesToRows(values);

    expect(rows).toEqual([
      { index: 1, data: { Name: 'Alice', Age: 30 } },
      { index: 2, data: { Name: 'Bob', Age: 25 } },
    ]);
  });

  it('falls back to column letters when there is no clear header row', () => {
    const values = [
      ['Alice', 30],
      ['Bob', 25],
    ];

    const rows = convertSheetValuesToRows(values);

    expect(rows).toEqual([
      { index: 0, data: { A: 'Alice', B: 30 } },
      { index: 1, data: { A: 'Bob', B: 25 } },
    ]);
  });

  it('skips empty rows in the output', () => {
    const rows = convertSheetValuesToRows([['Name'], [''], ['Alice']]);

    expect(rows).toEqual([{ index: 2, data: { Name: 'Alice' } }]);
  });
});

describe('syncTabularRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findKnowledgeItemByUri.mockResolvedValue(undefined);
    mocks.createKnowledgeItem.mockResolvedValue({ id: 'item-1' });
    mocks.updateKnowledgeItem.mockResolvedValue({ id: 'item-1' });
  });

  it('ingests new rows and returns counts', async () => {
    const rows = [
      { index: 1, data: { Name: 'Alice' } },
      { index: 2, data: { Name: 'Bob' } },
    ];

    const result = await syncTabularRows({
      ctx: ctx(),
      connector: connector(),
      kind: 'csv',
      rows,
      uriPrefix: 'csv://inline',
      sourceMeta: { sourceName: 'inline' },
    });

    expect(result.applied).toBe(true);
    expect(result.output).toMatchObject({ ingested: 2, updated: 0, skipped: 0, totalRows: 2 });
    expect(mocks.createKnowledgeItem).toHaveBeenCalledTimes(2);
  });

  it('skips rows whose content hash has not changed', async () => {
    const rows = [{ index: 1, data: { Name: 'Alice' } }];
    mocks.findKnowledgeItemByUri.mockResolvedValue(undefined);

    await syncTabularRows({
      ctx: ctx(),
      connector: connector(),
      kind: 'csv',
      rows,
      uriPrefix: 'csv://inline',
      sourceMeta: { sourceName: 'inline' },
    });

    const createdHash = (mocks.createKnowledgeItem.mock.calls[0]?.[1] as { hash: string }).hash;
    vi.clearAllMocks();
    mocks.findKnowledgeItemByUri.mockResolvedValue({ id: 'item-1', hash: createdHash });

    const result = await syncTabularRows({
      ctx: ctx(),
      connector: connector(),
      kind: 'csv',
      rows,
      uriPrefix: 'csv://inline',
      sourceMeta: { sourceName: 'inline' },
    });

    expect(result.output).toMatchObject({ ingested: 0, updated: 0, skipped: 1 });
    expect(mocks.createKnowledgeItem).not.toHaveBeenCalled();
    expect(mocks.updateKnowledgeItem).not.toHaveBeenCalled();
  });

  it('updates existing rows when content hash changed', async () => {
    const rows = [{ index: 1, data: { Name: 'Alice' } }];
    mocks.findKnowledgeItemByUri.mockResolvedValue({ id: 'item-1', hash: 'old-hash' });

    const result = await syncTabularRows({
      ctx: ctx(),
      connector: connector(),
      kind: 'csv',
      rows,
      uriPrefix: 'csv://inline',
      sourceMeta: { sourceName: 'inline' },
    });

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
});
