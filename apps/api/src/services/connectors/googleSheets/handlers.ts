import { GoogleSheetsSyncInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind, updateConnector } from '../../../repositories/connector';

import { convertSheetValuesToRows, syncTabularRows } from '../spreadsheet-sync';
import type { ConnectorApplyConfig, ConnectorApplyFn } from '../write-registry';
import { connectorWriteRegistry } from '../write-registry';

const GOOGLE_SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function fetchGoogleSheetValues(
  tenantId: string,
  secretRef: string,
  spreadsheetId: string,
  range: string,
  maxRows: number
): Promise<{ values: unknown[][]; truncated: boolean }> {
  const accessToken = await secrets.getForTenant(tenantId, secretRef);
  if (!accessToken) {
    throw new Error('Google Sheets access token not found');
  }

  const encodedRange = encodeURIComponent(range);
  const url = `${GOOGLE_SHEETS_API_URL}/${spreadsheetId}/values/${encodedRange}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { values?: unknown[][] };
  const values = data.values ?? [];
  const truncated = values.length > maxRows;
  return { values: values.slice(0, maxRows), truncated };
}

connectorWriteRegistry.register({
  kind: 'googleSheets',
  action: 'sync',
  inputSchema: GoogleSheetsSyncInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => {
    const payload = input as { spreadsheetId: string; range?: string };
    return `Sync Google Sheet "${payload.spreadsheetId}" range "${payload.range ?? 'Sheet1'}" into knowledge`;
  },
  approvalMessage: (input) => {
    const payload = input as { spreadsheetId: string; range?: string };
    return {
      title: 'Sync Google Sheet into knowledge',
      description: `Pull rows from Google Sheet "${payload.spreadsheetId}" range "${payload.range ?? 'Sheet1'}" into the knowledge graph`,
    };
  },
  apply: (async (ctx: TenantContext, config: ConnectorApplyConfig, input: unknown) => {
    const connector = await findConnectorByKind(ctx, 'googleSheets');
    if (!connector) {
      return { applied: false, reason: 'Google Sheets connector not configured', output: {} };
    }

    const payload = input as { spreadsheetId: string; range?: string; maxRows?: number };
    const range = payload.range ?? 'Sheet1';
    const maxRows = payload.maxRows ?? 1000;

    const { values, truncated } = await fetchGoogleSheetValues(
      config.tenantId,
      config.secretRef,
      payload.spreadsheetId,
      range,
      maxRows
    );

    const rows = convertSheetValuesToRows(values);
    const uriPrefix = `gsheets://${payload.spreadsheetId}/${range}`;

    const result = await syncTabularRows({
      ctx,
      connector,
      kind: 'googleSheets',
      rows,
      uriPrefix,
      sourceMeta: { spreadsheetId: payload.spreadsheetId, range, truncated },
    });

    if (result.applied) {
      await updateConnector(ctx, connector.id, { lastSync: new Date() });
    }

    return result;
  }) as unknown as ConnectorApplyFn,
});
