import {
  AirtableGetRecordInput,
  AirtableListBasesInput,
  AirtableListRecordsInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { AirtableClient } from './client';

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
