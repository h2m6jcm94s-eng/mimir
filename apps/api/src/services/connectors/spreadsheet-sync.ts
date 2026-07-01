import type * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import {
  createEmbeddings,
  createKnowledgeItem,
  deleteEmbeddingsByKnowledgeItemId,
  findKnowledgeItemByUri,
  updateKnowledgeItem,
} from '../../repositories/knowledge';
import type { ApplyResult } from '../apply/registry';
import { chunkText, computeContentHash, generateEmbeddingForTier } from '../knowledge/ingest';

export interface SpreadsheetRow {
  index: number;
  data: Record<string, unknown>;
}

function columnLetter(index: number): string {
  let result = '';
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function isHeaderRow(row: unknown[]): boolean {
  return row.length > 0 && row.every((cell) => typeof cell === 'string' && cell.length > 0);
}

export function convertSheetValuesToRows(values: unknown[][]): SpreadsheetRow[] {
  if (values.length === 0) return [];

  const firstRow = values[0];
  const hasHeader = isHeaderRow(firstRow);
  const headers = hasHeader
    ? firstRow.map((cell) => String(cell))
    : firstRow.map((_, idx) => columnLetter(idx));

  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .map((row, idx) => {
      const data: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i += 1) {
        data[headers[i]] = row[i] ?? '';
      }
      return { index: hasHeader ? idx + 1 : idx, data };
    })
    .filter((row) => !isEmptyRow(row));
}

export interface SyncTabularInput {
  ctx: TenantContext;
  connector: typeof schema.connector.$inferSelect;
  kind: 'csv' | 'xlsx' | 'googleSheets';
  rows: SpreadsheetRow[];
  uriPrefix: string;
  sourceMeta: Record<string, unknown>;
}

function rowContent(
  kind: string,
  uriPrefix: string,
  row: SpreadsheetRow,
  sourceMeta: Record<string, unknown>
): string {
  return [
    `${kind.toUpperCase()} row ${row.index}`,
    `Source: ${uriPrefix}`,
    `URI: ${uriPrefix}/row/${row.index}`,
    '',
    'Source metadata:',
    JSON.stringify(sourceMeta, null, 2),
    '',
    'Row data:',
    JSON.stringify(row.data, null, 2),
  ].join('\n');
}

function isEmptyRow(row: SpreadsheetRow): boolean {
  const values = Object.values(row.data);
  if (values.length === 0) return true;
  return values.every((value) => value === undefined || value === null || value === '');
}

export async function syncTabularRows(input: SyncTabularInput): Promise<ApplyResult> {
  const { ctx, connector, kind, rows, uriPrefix, sourceMeta } = input;
  const tier = (connector.tier as 0 | 1 | 2) ?? 1;

  let ingested = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isEmptyRow(row)) continue;

    const uri = `${uriPrefix}/row/${row.index}`;
    const content = rowContent(kind, uriPrefix, row, sourceMeta);
    const hash = computeContentHash(content);

    const existing = await findKnowledgeItemByUri(ctx, uri);

    if (existing && existing.hash === hash) {
      skipped += 1;
      continue;
    }

    const meta = {
      source: kind,
      rowIndex: row.index,
      ...sourceMeta,
    };

    if (existing) {
      await updateKnowledgeItem(ctx, existing.id, { content, hash, tier, meta });
      await deleteEmbeddingsByKnowledgeItemId(ctx, existing.id);
      await createRowEmbeddings(ctx, existing.id, content, tier);
      updated += 1;
    } else {
      const item = await createKnowledgeItem(ctx, {
        kind: 'doc',
        uri,
        tier,
        hash,
        content,
        meta,
      });
      await createRowEmbeddings(ctx, item.id, content, tier);
      ingested += 1;
    }
  }

  return {
    applied: true,
    reason: `${kind} sync complete for ${uriPrefix}`,
    output: {
      uriPrefix,
      ingested,
      updated,
      skipped,
      totalRows: rows.length,
    },
  };
}

async function createRowEmbeddings(
  ctx: TenantContext,
  knowledgeItemId: string,
  content: string,
  tier: 0 | 1 | 2
): Promise<void> {
  const chunks = chunkText(content);
  if (chunks.length === 0) return;

  const embeddings = await Promise.all(
    chunks.map(async (text, idx) => ({
      knowledgeItemId,
      chunkIdx: idx,
      text,
      vector: await generateEmbeddingForTier(ctx, text, tier),
      meta: {},
    }))
  );

  await createEmbeddings(ctx, embeddings);
}
