import { and, count, desc, eq, gt, ilike, inArray, max } from 'drizzle-orm';
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
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  sources?: string;
}

export interface CursorPaginationInput {
  limit: number;
  cursor?: string;
}

export async function createSession(
  ctx: TenantContext,
  input: CreateSessionInput
): Promise<typeof schema.session.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
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

  const rows = await ctx.tenantScopedDb
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
  const [row] = await ctx.tenantScopedDb
    .insert(schema.message)
    .values({
      tenantId: ctx.tenantId,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      model: input.model,
      tier: input.tier ?? 0,
      platformMessageId: input.platformMessageId,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      costUsd: input.costUsd ?? 0,
      sources: input.sources,
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
  const rows = await ctx.tenantScopedDb
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

export async function getSessionById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.session.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.session)
    .where(and(eq(schema.session.id, id), eq(schema.session.tenantId, ctx.tenantId)));
  return row;
}

export async function getSessionRootId(ctx: TenantContext, id: string): Promise<string> {
  const visited = new Set<string>();
  let current = id;
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const row = await getSessionById(ctx, current);
    if (!row || !row.parentId) break;
    current = row.parentId;
  }
  return current;
}

export async function getSessionMessages(
  ctx: TenantContext,
  sessionId: string
): Promise<(typeof schema.message.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.message)
    .where(and(eq(schema.message.tenantId, ctx.tenantId), eq(schema.message.sessionId, sessionId)))
    .orderBy(schema.message.createdAt);
}

export interface SessionStateResult {
  session: typeof schema.session.$inferSelect;
  messages: (typeof schema.message.$inferSelect)[];
}

export async function getSessionState(
  ctx: TenantContext,
  id: string
): Promise<SessionStateResult | undefined> {
  const session = await getSessionById(ctx, id);
  if (!session) return undefined;
  const rootId = await getSessionRootId(ctx, id);
  const messages = await getSessionMessages(ctx, rootId);
  return { session, messages };
}

export async function createChildSession(
  ctx: TenantContext,
  input: CreateSessionInput & { parentId: string }
): Promise<typeof schema.session.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
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

export interface ActiveSessionResult {
  id: string;
  source: string;
  model: string | null;
  lastMessageAt: Date;
  messageCount: number;
}

export async function listActiveSessions(
  ctx: TenantContext,
  options: { limit?: number; days?: number } = {}
): Promise<ActiveSessionResult[]> {
  const limit = options.limit ?? 50;
  const days = options.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const recent = await ctx.tenantScopedDb
    .select({
      sessionId: schema.message.sessionId,
      lastMessageAt: max(schema.message.createdAt),
    })
    .from(schema.message)
    .where(and(eq(schema.message.tenantId, ctx.tenantId), gt(schema.message.createdAt, since)))
    .groupBy(schema.message.sessionId)
    .orderBy(desc(max(schema.message.createdAt)))
    .limit(limit);

  if (recent.length === 0) return [];

  const sessionIds = recent.map((r) => r.sessionId);

  const sessions = await ctx.tenantScopedDb
    .select()
    .from(schema.session)
    .where(and(eq(schema.session.tenantId, ctx.tenantId), inArray(schema.session.id, sessionIds)));

  const counts = await ctx.tenantScopedDb
    .select({ sessionId: schema.message.sessionId, messageCount: count() })
    .from(schema.message)
    .where(inArray(schema.message.sessionId, sessionIds))
    .groupBy(schema.message.sessionId);

  const countMap = new Map(counts.map((c) => [c.sessionId, c.messageCount]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  return recent
    .map((r) => {
      const session = sessionMap.get(r.sessionId);
      if (!session) return null;
      return {
        id: session.id,
        source: session.source as string,
        model: session.model,
        lastMessageAt: r.lastMessageAt ?? new Date(),
        messageCount: countMap.get(session.id) ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export interface MessageSearchResult {
  message: typeof schema.message.$inferSelect;
  session: typeof schema.session.$inferSelect;
}

export async function searchMessages(
  ctx: TenantContext,
  query: string,
  limit: number
): Promise<MessageSearchResult[]> {
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = `%${escaped}%`;

  return ctx.tenantScopedDb
    .select({
      message: schema.message,
      session: schema.session,
    })
    .from(schema.message)
    .innerJoin(schema.session, eq(schema.message.sessionId, schema.session.id))
    .where(and(eq(schema.message.tenantId, ctx.tenantId), ilike(schema.message.content, pattern)))
    .orderBy(desc(schema.message.createdAt))
    .limit(limit);
}
