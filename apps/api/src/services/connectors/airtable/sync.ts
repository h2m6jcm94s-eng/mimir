import type { AirtableSyncInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind, updateConnector } from '../../../repositories/connector';
import {
  createEmbeddings,
  createKnowledgeItem,
  deleteEmbeddingsByKnowledgeItemId,
  findKnowledgeItemByUri,
  updateKnowledgeItem,
} from '../../../repositories/knowledge';
import type { ApplyResult } from '../../apply/registry';
import { chunkText, computeContentHash, generateEmbeddingForTier } from '../../knowledge/ingest';
import type { ConnectorApplyConfig } from '../write-registry';
import { AirtableClient } from './client';

export function recordUri(baseId: string, tableId: string, recordId: string): string {
  return `airtable://${baseId}/${tableId}/${recordId}`;
}

export function recordContent(
  baseId: string,
  tableId: string,
  record: { id: string; createdTime: string; fields: Record<string, unknown> }
): string {
  return [
    `Airtable record: ${record.id}`,
    `Base: ${baseId}`,
    `Table: ${tableId}`,
    `Created: ${record.createdTime}`,
    '',
    'Fields:',
    JSON.stringify(record.fields, null, 2),
  ].join('\n');
}

export async function syncAirtableTable(
  ctx: TenantContext,
  config: ConnectorApplyConfig,
  input: AirtableSyncInput
): Promise<ApplyResult> {
  const connector = await findConnectorByKind(ctx, 'airtable');
  if (!connector) {
    return { applied: false, reason: 'Airtable connector not configured', output: {} };
  }

  const client = new AirtableClient(
    { tenantId: config.tenantId, secretRef: config.secretRef },
    secrets
  );

  let ingested = 0;
  let updated = 0;
  let skipped = 0;

  const tier = (connector.tier as 0 | 1 | 2) ?? 1;

  for await (const record of client.listAllRecords({
    baseId: input.baseId,
    tableId: input.tableId,
    maxRecords: input.maxRecords,
  })) {
    const uri = recordUri(input.baseId, input.tableId, record.id);
    const content = recordContent(input.baseId, input.tableId, record);
    const hash = computeContentHash(content);

    const existing = await findKnowledgeItemByUri(ctx, uri);

    if (existing && existing.hash === hash) {
      skipped += 1;
      continue;
    }

    const meta = {
      source: 'airtable',
      baseId: input.baseId,
      tableId: input.tableId,
      recordId: record.id,
    };

    if (existing) {
      await updateKnowledgeItem(ctx, existing.id, { content, hash, tier, meta });
      await deleteEmbeddingsByKnowledgeItemId(ctx, existing.id);
      await createRecordEmbeddings(ctx, existing.id, content, tier);
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
      await createRecordEmbeddings(ctx, item.id, content, tier);
      ingested += 1;
    }
  }

  await updateConnector(ctx, connector.id, { lastSync: new Date() });

  return {
    applied: true,
    reason: `Airtable sync complete for ${input.tableId}`,
    output: {
      baseId: input.baseId,
      tableId: input.tableId,
      ingested,
      updated,
      skipped,
    },
  };
}

async function createRecordEmbeddings(
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
