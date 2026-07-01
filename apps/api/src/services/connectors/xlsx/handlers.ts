import { XlsxSyncInput } from '@mimir/shared-types';
import * as xlsx from 'xlsx';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind, updateConnector } from '../../../repositories/connector';

import { convertSheetValuesToRows, syncTabularRows } from '../spreadsheet-sync';
import type { ConnectorApplyConfig, ConnectorApplyFn } from '../write-registry';
import { connectorWriteRegistry } from '../write-registry';

connectorWriteRegistry.register({
  kind: 'xlsx',
  action: 'sync',
  inputSchema: XlsxSyncInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => {
    const payload = input as { fileName?: string; sheetName?: string };
    return `Sync XLSX "${payload.fileName ?? 'workbook.xlsx'}" sheet "${payload.sheetName ?? 'Sheet1'}" into knowledge`;
  },
  approvalMessage: (input) => {
    const payload = input as { fileName?: string; sheetName?: string };
    return {
      title: 'Sync XLSX into knowledge',
      description: `Pull rows from XLSX "${payload.fileName ?? 'workbook.xlsx'}" sheet "${payload.sheetName ?? 'Sheet1'}" into the knowledge graph`,
    };
  },
  apply: (async (ctx: TenantContext, _config: ConnectorApplyConfig, input: unknown) => {
    const connector = await findConnectorByKind(ctx, 'xlsx');
    if (!connector) {
      return { applied: false, reason: 'XLSX connector not configured', output: {} };
    }

    const payload = input as { base64Content: string; fileName?: string; sheetName?: string };
    const buffer = Buffer.from(payload.base64Content, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = payload.sheetName ?? workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return { applied: false, reason: `Sheet "${sheetName}" not found`, output: {} };
    }

    const values = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    const rows = convertSheetValuesToRows(values);
    const fileName = payload.fileName ?? 'workbook.xlsx';
    const uriPrefix = `xlsx://${fileName}/${sheetName}`;

    const result = await syncTabularRows({
      ctx,
      connector,
      kind: 'xlsx',
      rows,
      uriPrefix,
      sourceMeta: { fileName, sheetName },
    });

    if (result.applied) {
      await updateConnector(ctx, connector.id, { lastSync: new Date() });
    }

    return result;
  }) as unknown as ConnectorApplyFn,
});

export function parseXlsxBase64(
  base64Content: string,
  sheetName?: string
): { sheetName: string; rows: ReturnType<typeof convertSheetValuesToRows> } {
  const buffer = Buffer.from(base64Content, 'base64');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const selectedSheetName = sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${selectedSheetName}" not found`);
  }
  const values = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  return { sheetName: selectedSheetName, rows: convertSheetValuesToRows(values) };
}
