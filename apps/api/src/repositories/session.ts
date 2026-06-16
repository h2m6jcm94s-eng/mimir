import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateSessionInput {
  source: string;
  model?: string;
  parentId?: string;
}

export interface CreateMessageInput {
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  tier?: number;
  platformMessageId?: string;
}

export interface CursorPaginationInput {
  limit: number;
  cursor?: string;
}

export async function createSession(
  ctx: TenantContext,
  input: CreateSessionInput
): Promise<typeof schema.session.$inferSelect> {
  const [row] = await db
    .insert(schema.session)
    .values({
      tenantId: ctx.tenantId,
      source: input.source as (typeof schema.session.source.enumValues)[number],
      model: input.model,
      parentId: input.parentId,
    })
    .returning();
  return row;
}

export async function listSessions(
  ctx: TenantContext,
  pagination: CursorPaginationInput
): Promise<{ data: (typeof schema.session.$inferSelect)[]; nextCursor?: string }> {
  const limit = pagination.limit;
  const conditions = [eq(schema.session.tenantId, ctx.tenantId)];

  if (pagination.cursor) {
    conditions.push(gt(schema.session.id, pagination.cursor));
  }

  const rows = await db
    .select()
    .from(schema.session)
    .where(and(...conditions))
    .orderBy(desc(schema.session.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return { data, nextCursor };
}

export async function createMessage(
  ctx: TenantContext,
  input: CreateMessageInput
): Promise<typeof schema.message.$inferSelect> {
  const [row] = await db
    .insert(schema.message)
    .values({
      tenantId: ctx.tenantId,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      model: input.model,
      tier: input.tier ?? 0,
      platformMessageId: input.platformMessageId,
    })
    .returning();
  return row;
}

export async function listMessages(
  ctx: TenantContext,
  sessionId: string,
  pagination: CursorPaginationInput
): Promise<{ data: (typeof schema.message.$inferSelect)[]; nextCursor?: string }> {
  const limit = pagination.limit;
  const rows = await db
    .select()
    .from(schema.message)
    .where(and(eq(schema.message.tenantId, ctx.tenantId), eq(schema.message.sessionId, sessionId)))
    .orderBy(desc(schema.message.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return { data, nextCursor };
}
