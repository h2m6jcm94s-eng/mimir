import {
  NotionAppendBlocksInput,
  NotionDatabaseInput,
  NotionPageInput,
  NotionQueryDatabaseInput,
  NotionSearchInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { NotionClient } from './client';

export const notionHandlers: Record<string, ConnectorActionHandler> = {
  search: async (_ctx, config, input) => {
    const client = new NotionClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = NotionSearchInput.parse(input);
    const results = await client.search(parsed);
    return { results };
  },

  getPage: async (_ctx, config, input) => {
    const client = new NotionClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = NotionPageInput.parse(input);
    const page = await client.getPage(parsed);
    return { page };
  },

  getDatabase: async (_ctx, config, input) => {
    const client = new NotionClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = NotionDatabaseInput.parse(input);
    const database = await client.getDatabase(parsed);
    return { database };
  },

  queryDatabase: async (_ctx, config, input) => {
    const client = new NotionClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = NotionQueryDatabaseInput.parse(input);
    const records = await client.queryDatabase(parsed);
    return { records };
  },
};

connectorWriteRegistry.register({
  kind: 'notion',
  action: 'appendBlockChildren',
  inputSchema: NotionAppendBlocksInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { blockId: string }).blockId,
  approvalMessage: (input) => {
    const payload = input as { blockId: string; children: Record<string, unknown>[] };
    return {
      title: 'Append blocks to Notion page',
      description: `Append ${payload.children.length} block(s) to Notion block "${payload.blockId}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new NotionClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { blockId: string; children: Record<string, unknown>[] };
    const result = await client.appendBlockChildren(payload);
    return { applied: true, reason: 'Blocks appended', output: result as Record<string, unknown> };
  },
});
