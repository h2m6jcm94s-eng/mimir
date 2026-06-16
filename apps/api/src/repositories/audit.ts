import { createHash } from 'node:crypto';
import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface AuditEventInput {
  actor: string;
  action: string;
  tier: number;
  payload: Record<string, unknown>;
  sources?: Record<string, unknown>[];
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  prevHash: string | null;
  hash: string;
  actor: string;
  action: string;
  tier: number;
  payloadHash: string;
  sources: Record<string, unknown>[] | null;
  ts: Date;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function canonicalize(input: unknown): string {
  return JSON.stringify(input, Object.keys(input as object).sort());
}

function computeEventHash(input: {
  prevHash: string | null;
  payloadHash: string;
  actor: string;
  action: string;
  tier: number;
  ts: string;
}): string {
  return sha256(
    canonicalize({
      prevHash: input.prevHash ?? '',
      payloadHash: input.payloadHash,
      actor: input.actor,
      action: input.action,
      tier: input.tier,
      ts: input.ts,
    })
  );
}

export async function getLatestHash(ctx: TenantContext): Promise<string | null> {
  const [latest] = await db
    .select({ hash: schema.auditEvent.hash })
    .from(schema.auditEvent)
    .where(eq(schema.auditEvent.tenantId, ctx.tenantId))
    .orderBy(desc(schema.auditEvent.ts), desc(schema.auditEvent.id))
    .limit(1);
  return latest?.hash ?? null;
}

export async function createAuditEvent(
  ctx: TenantContext,
  input: AuditEventInput
): Promise<AuditEvent> {
  const prevHash = await getLatestHash(ctx);
  const payloadHash = sha256(canonicalize(input.payload));
  const tsIso = new Date().toISOString();
  const hash = computeEventHash({
    prevHash,
    payloadHash,
    actor: input.actor,
    action: input.action,
    tier: input.tier,
    ts: tsIso,
  });

  const [row] = await db
    .insert(schema.auditEvent)
    .values({
      tenantId: ctx.tenantId,
      prevHash,
      hash,
      actor: input.actor,
      action: input.action,
      tier: input.tier,
      payloadHash,
      sources: input.sources ?? [],
      ts: new Date(tsIso),
    })
    .returning();

  return row as AuditEvent;
}

export interface ListAuditEventsInput {
  limit: number;
  cursor?: { ts: string; id: string };
}

export async function listAuditEvents(
  ctx: TenantContext,
  input: ListAuditEventsInput
): Promise<{ data: AuditEvent[]; nextCursor?: { ts: string; id: string } }> {
  const tenantFilter = eq(schema.auditEvent.tenantId, ctx.tenantId);
  const cursorFilter = input.cursor
    ? and(
        lt(schema.auditEvent.ts, new Date(input.cursor.ts)),
        lt(schema.auditEvent.id, input.cursor.id)
      )
    : undefined;
  const where = cursorFilter ? and(tenantFilter, cursorFilter) : tenantFilter;

  const rows = await db
    .select()
    .from(schema.auditEvent)
    .where(where)
    .orderBy(desc(schema.auditEvent.ts), desc(schema.auditEvent.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? { ts: last.ts.toISOString(), id: last.id } : undefined;

  return { data: data as AuditEvent[], nextCursor };
}

export function verifyChain(events: AuditEvent[]): boolean {
  let previousHash: string | null = null;
  for (const event of events) {
    const expected = computeEventHash({
      prevHash: previousHash,
      payloadHash: event.payloadHash,
      actor: event.actor,
      action: event.action,
      tier: event.tier,
      ts: event.ts.toISOString(),
    });
    if (event.hash !== expected) return false;
    if (event.prevHash !== previousHash) return false;
    previousHash = event.hash;
  }
  return true;
}
