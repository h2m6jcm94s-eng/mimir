import {
  StripeListChargesInput,
  StripeListPayoutsInput,
  StripeListSubscriptionsInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { type SalesRecord, buildSalesReport } from '../sales-report';
import { StripeClient } from './client';

function toDateOnly(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export function stripeChargesToRecords(charges: {
  data?: Array<Record<string, unknown>>;
}): SalesRecord[] {
  return (charges.data ?? []).map((charge) => {
    const amount = (charge.amount as number) ?? 0;
    const amountRefunded = (charge.amount_refunded as number) ?? 0;
    const currency = (charge.currency as string) ?? 'usd';
    const created = charge.created as number;
    const customer = charge.customer as string | undefined;
    const receiptEmail = charge.receipt_email as string | undefined;

    const gross = amount / 100;
    const refunds = amountRefunded / 100;
    return {
      id: `stripe:${charge.id as string}`,
      date: toDateOnly(created),
      grossAmountUsd: gross,
      refundAmountUsd: refunds,
      feeAmountUsd: 0,
      netAmountUsd: gross - refunds,
      currency,
      source: 'stripe',
      sourceRecordId: String(charge.id),
      customerHint: receiptEmail ?? customer,
      reference: charge.payment_intent as string | undefined,
      metadata: charge,
    };
  });
}

export const stripeHandlers: Record<string, ConnectorActionHandler> = {
  listCharges: async (_ctx, config, input) => {
    const client = new StripeClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = StripeListChargesInput.parse(input);
    const charges = (await client.listCharges(parsed)) as { data: Array<Record<string, unknown>> };
    return { charges: charges.data };
  },

  listSubscriptions: async (_ctx, config, input) => {
    const client = new StripeClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = StripeListSubscriptionsInput.parse(input);
    const subscriptions = (await client.listSubscriptions(parsed)) as {
      data: Array<Record<string, unknown>>;
    };
    return { subscriptions: subscriptions.data };
  },

  listPayouts: async (_ctx, config, input) => {
    const client = new StripeClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = StripeListPayoutsInput.parse(input);
    const payouts = (await client.listPayouts(parsed)) as { data: Array<Record<string, unknown>> };
    return { payouts: payouts.data };
  },

  salesReport: async (_ctx, config, input) => {
    const client = new StripeClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const period = (input.period as 'day' | 'week' | 'month' | 'quarter' | 'year') ?? 'month';
    const from = input.from as string | undefined;
    const to = input.to as string | undefined;
    const limit = 100;
    const charges = (await client.listCharges({
      limit,
      createdAfter: from,
      createdBefore: to,
    })) as {
      data: Array<Record<string, unknown>>;
    };
    const records = stripeChargesToRecords(charges);
    return { report: buildSalesReport(records, period, from, to) };
  },
};
