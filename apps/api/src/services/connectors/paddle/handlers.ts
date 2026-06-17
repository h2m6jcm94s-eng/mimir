import { PaddleListSubscriptionsInput, PaddleListTransactionsInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { type SalesRecord, buildSalesReport } from '../sales-report';
import { PaddleClient } from './client';

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function centsToUsd(cents: number | undefined): number {
  if (cents === undefined || Number.isNaN(cents)) return 0;
  return cents / 100;
}

export function paddleTransactionsToRecords(transactions: {
  data?: Array<{
    id: string;
    status?: string;
    created_at?: string;
    customer_id?: string;
    details?: {
      totals?: {
        total?: number;
        fee?: number;
      };
    };
  }>;
}): SalesRecord[] {
  return (transactions.data ?? []).map((tx) => {
    const gross = centsToUsd(tx.details?.totals?.total);
    const fee = centsToUsd(tx.details?.totals?.fee);
    const net = gross - fee;
    return {
      id: `paddle:${tx.id}`,
      date: toDateOnly(tx.created_at ?? new Date().toISOString()),
      grossAmountUsd: gross,
      refundAmountUsd: tx.status === 'refunded' ? gross : 0,
      feeAmountUsd: fee,
      netAmountUsd: net,
      currency: 'usd',
      source: 'paddle',
      sourceRecordId: tx.id,
      customerHint: tx.customer_id,
      metadata: tx,
    };
  });
}

export const paddleHandlers: Record<string, ConnectorActionHandler> = {
  listTransactions: async (_ctx, config, input) => {
    const client = new PaddleClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = PaddleListTransactionsInput.parse(input);
    const transactions = (await client.listTransactions(parsed)) as {
      data: Array<Record<string, unknown>>;
    };
    return { transactions: transactions.data };
  },

  listSubscriptions: async (_ctx, config, input) => {
    const client = new PaddleClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = PaddleListSubscriptionsInput.parse(input);
    const subscriptions = (await client.listSubscriptions(parsed)) as {
      data: Array<Record<string, unknown>>;
    };
    return { subscriptions: subscriptions.data };
  },

  salesReport: async (_ctx, config, input) => {
    const client = new PaddleClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const period = (input.period as 'day' | 'week' | 'month' | 'quarter' | 'year') ?? 'month';
    const from = input.from as string | undefined;
    const to = input.to as string | undefined;
    const transactions = (await client.listTransactions({ limit: 100, after: from })) as {
      data: Array<{
        id: string;
        status?: string;
        created_at?: string;
        customer_id?: string;
        details?: Record<string, unknown>;
      }>;
    };
    const records = paddleTransactionsToRecords(transactions);
    return { report: buildSalesReport(records, period, from, to) };
  },
};
