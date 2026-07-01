import { CsvSyncInput } from '@mimir/shared-types';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind, updateConnector } from '../../../repositories/connector';

import {
  type SpreadsheetRow,
  convertSheetValuesToRows,
  syncTabularRows,
} from '../spreadsheet-sync';
import type { ConnectorApplyConfig, ConnectorApplyFn } from '../write-registry';
import { connectorWriteRegistry } from '../write-registry';

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

export function parseCsv(content: string): SpreadsheetRow[] {
  const lines = content
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const parsed = lines.map(parseCsvLine);
  return convertSheetValuesToRows(parsed);
}

connectorWriteRegistry.register({
  kind: 'csv',
  action: 'sync',
  inputSchema: CsvSyncInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => {
    const payload = input as { sourceName?: string };
    return `Sync CSV source "${payload.sourceName ?? 'inline'}" into knowledge`;
  },
  approvalMessage: (input) => {
    const payload = input as { sourceName?: string };
    return {
      title: 'Sync CSV into knowledge',
      description: `Pull rows from CSV source "${payload.sourceName ?? 'inline'}" into the knowledge graph`,
    };
  },
  apply: (async (ctx: TenantContext, _config: ConnectorApplyConfig, input: unknown) => {
    const connector = await findConnectorByKind(ctx, 'csv');
    if (!connector) {
      return { applied: false, reason: 'CSV connector not configured', output: {} };
    }

    const payload = input as { content: string; sourceName?: string };
    const rows = parseCsv(payload.content);
    const sourceName = payload.sourceName ?? 'inline';
    const uriPrefix = `csv://${sourceName}`;

    const result = await syncTabularRows({
      ctx,
      connector,
      kind: 'csv',
      rows,
      uriPrefix,
      sourceMeta: { sourceName },
    });

    if (result.applied) {
      await updateConnector(ctx, connector.id, { lastSync: new Date() });
    }

    return result;
  }) as unknown as ConnectorApplyFn,
});
