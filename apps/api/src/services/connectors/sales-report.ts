export interface SalesRecord {
  id: string;
  date: string; // ISO date only
  grossAmountUsd: number;
  refundAmountUsd: number;
  feeAmountUsd: number;
  netAmountUsd: number;
  currency: string;
  source: string;
  sourceRecordId: string;
  customerHint?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface SalesReportBucket {
  key: string;
  grossAmountUsd: number;
  refundAmountUsd: number;
  feeAmountUsd: number;
  netAmountUsd: number;
  count: number;
}

export interface SalesReportSourceSummary {
  grossAmountUsd: number;
  refundAmountUsd: number;
  feeAmountUsd: number;
  netAmountUsd: number;
  count: number;
}

export interface SalesReport {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  from: string;
  to: string;
  totals: SalesReportSourceSummary;
  buckets: SalesReportBucket[];
  bySource: Record<string, SalesReportSourceSummary>;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function startOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function quarterKey(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const q = Math.floor((Number(month) - 1) / 3) + 1;
  return `${year}-Q${q}`;
}

function bucketKey(record: SalesRecord, period: SalesReport['period']): string {
  switch (period) {
    case 'day':
      return record.date;
    case 'week':
      return startOfWeek(record.date);
    case 'month':
      return record.date.slice(0, 7);
    case 'quarter':
      return quarterKey(record.date);
    case 'year':
      return record.date.slice(0, 4);
    default:
      return record.date;
  }
}

function emptySummary(): SalesReportSourceSummary {
  return { grossAmountUsd: 0, refundAmountUsd: 0, feeAmountUsd: 0, netAmountUsd: 0, count: 0 };
}

function addToSummary(summary: SalesReportSourceSummary, record: SalesRecord): void {
  summary.grossAmountUsd += record.grossAmountUsd;
  summary.refundAmountUsd += record.refundAmountUsd;
  summary.feeAmountUsd += record.feeAmountUsd;
  summary.netAmountUsd += record.netAmountUsd;
  summary.count += 1;
}

export function buildSalesReport(
  records: SalesRecord[],
  period: SalesReport['period'],
  from?: string,
  to?: string
): SalesReport {
  const fromDate = from ? toDateOnly(from) : undefined;
  const toDate = to ? toDateOnly(to) : undefined;

  const filtered = records.filter((r) => {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  });

  const totals = emptySummary();
  const bySource: Record<string, SalesReportSourceSummary> = {};
  const bucketMap = new Map<string, SalesReportBucket>();

  for (const record of filtered) {
    addToSummary(totals, record);

    bySource[record.source] ??= emptySummary();
    addToSummary(bySource[record.source], record);

    const key = bucketKey(record, period);
    const bucket = bucketMap.get(key) ?? {
      key,
      ...emptySummary(),
    };
    addToSummary(bucket, record);
    bucketMap.set(key, bucket);
  }

  const buckets = Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  return {
    period,
    from: fromDate ?? buckets[0]?.key ?? '',
    to: toDate ?? buckets[buckets.length - 1]?.key ?? '',
    totals,
    buckets,
    bySource,
  };
}
