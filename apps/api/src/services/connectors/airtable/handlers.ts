import {
  AirtableCreateRecordInput,
  AirtableGetRecordInput,
  AirtableListBasesInput,
  AirtableListRecordsInput,
  AirtableSyncInput,
  AirtableUpdateRecordInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import type { ConnectorApplyFn } from '../write-registry';
import { connectorWriteRegistry } from '../write-registry';
import { AirtableClient } from './client';
import { syncAirtableTable } from './sync';

export const airtableHandlers: Record<string, ConnectorActionHandler> = {
  listBases: async (_ctx, config, input) => {
    const client = new AirtableClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = AirtableListBasesInput.parse(input);
    const bases = await client.listBases(parsed);
    return { bases };
  },

  listRecords: async (_ctx, config, input) => {
    const client = new AirtableClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = AirtableListRecordsInput.parse(input);
    const records = await client.listRecords(parsed);
    return { records };
  },

  getRecord: async (_ctx, config, input) => {
    const client = new AirtableClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = AirtableGetRecordInput.parse(input);
    const record = await client.getRecord(parsed);
    return { record };
  },
};

connectorWriteRegistry.register({
  kind: 'airtable',
  action: 'createRecord',
  inputSchema: AirtableCreateRecordInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { tableId: string }).tableId,
  approvalMessage: (input) => {
    const payload = input as { baseId: string; tableId: string };
    return {
      title: 'Create Airtable record',
      description: `Create a record in base "${payload.baseId}" / table "${payload.tableId}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new AirtableClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { baseId: string; tableId: string; fields: Record<string, unknown> };
    const result = await client.createRecord(payload);
    return { applied: true, reason: 'Record created', output: result as Record<string, unknown> };
  },
});

connectorWriteRegistry.register({
  kind: 'airtable',
  action: 'updateRecord',
  inputSchema: AirtableUpdateRecordInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { recordId: string }).recordId,
  approvalMessage: (input) => {
    const payload = input as { baseId: string; tableId: string; recordId: string };
    return {
      title: 'Update Airtable record',
      description: `Update record "${payload.recordId}" in base "${payload.baseId}" / table "${payload.tableId}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new AirtableClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as {
      baseId: string;
      tableId: string;
      recordId: string;
      fields: Record<string, unknown>;
    };
    const result = await client.updateRecord(payload);
    return { applied: true, reason: 'Record updated', output: result as Record<string, unknown> };
  },
});

connectorWriteRegistry.register({
  kind: 'airtable',
  action: 'sync',
  inputSchema: AirtableSyncInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => {
    const payload = input as { baseId: string; tableId: string };
    return `Sync Airtable base "${payload.baseId}" / table "${payload.tableId}"`;
  },
  approvalMessage: (input) => {
    const payload = input as { baseId: string; tableId: string };
    return {
      title: 'Sync Airtable table',
      description: `Pull records from base "${payload.baseId}" / table "${payload.tableId}" into knowledge`,
    };
  },
  apply: syncAirtableTable as unknown as ConnectorApplyFn,
});
