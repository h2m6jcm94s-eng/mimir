import {
  LemonSqueezyListOrdersInput,
  LemonSqueezyListSubscriptionsInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { type SalesRecord, buildSalesReport } from '../sales-report';
import { LemonSqueezyClient } from './client';

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function recordFromOrder(order: {
  id: string;
  attributes: {
    total: number;
    total_usd?: number;
    currency: string;
    created_at: string;
    customer_email?: string;
    order_number?: number;
    status?: string;
  };
}): SalesRecord {
  const attrs = order.attributes;
  const gross = attrs.total_usd ?? attrs.total / 100;
  return {
    id: `lemonSqueezy:${order.id}`,
    date: toDateOnly(attrs.created_at),
    grossAmountUsd: gross,
    refundAmountUsd: 0,
    feeAmountUsd: 0,
    netAmountUsd: gross,
    currency: attrs.currency,
    source: 'lemonSqueezy',
    sourceRecordId: order.id,
    customerHint: attrs.customer_email,
    reference: attrs.order_number ? String(attrs.order_number) : undefined,
    metadata: attrs,
  };
}

export function lemonSqueezyOrdersToRecords(orders: {
  data?: Array<{ id: string; attributes: Record<string, unknown> }>;
}): SalesRecord[] {
  return (orders.data ?? []).map((order) =>
    recordFromOrder(
      order as {
        id: string;
        attributes: {
          total: number;
          total_usd?: number;
          currency: string;
          created_at: string;
          customer_email?: string;
          order_number?: number;
          status?: string;
        };
      }
    )
  );
}

export const lemonSqueezyHandlers: Record<string, ConnectorActionHandler> = {
  listOrders: async (_ctx, config, input) => {
    const client = new LemonSqueezyClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = LemonSqueezyListOrdersInput.parse(input);
    const orders = (await client.listOrders(parsed)) as { data: Array<Record<string, unknown>> };
    return { orders: orders.data };
  },

  listSubscriptions: async (_ctx, config, input) => {
    const client = new LemonSqueezyClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = LemonSqueezyListSubscriptionsInput.parse(input);
    const subscriptions = (await client.listSubscriptions(parsed)) as {
      data: Array<Record<string, unknown>>;
    };
    return { subscriptions: subscriptions.data };
  },

  salesReport: async (_ctx, config, input) => {
    const client = new LemonSqueezyClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const period = (input.period as 'day' | 'week' | 'month' | 'quarter' | 'year') ?? 'month';
    const from = input.from as string | undefined;
    const to = input.to as string | undefined;
    const orders = (await client.listOrders({ limit: 100 })) as {
      data: Array<{ id: string; attributes: Record<string, unknown> }>;
    };
    const records = lemonSqueezyOrdersToRecords(orders);
    return { report: buildSalesReport(records, period, from, to) };
  },
};
