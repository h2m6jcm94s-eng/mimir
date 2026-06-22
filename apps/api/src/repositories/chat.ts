import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateChatChannelInput {
  title: string;
  createdByUserAccountId: string;
  participants: Array<{ userAccountId: string; encryptedChannelKey: string }>;
}

export interface CreateChatMessageInput {
  channelId: string;
  senderUserAccountId: string;
  encryptedPayload: Record<string, unknown>;
}

export interface ListChatMessagesOptions {
  limit?: number;
  before?: string;
}

export async function createChatChannel(
  ctx: TenantContext,
  input: CreateChatChannelInput
): Promise<
  typeof schema.chatChannel.$inferSelect & {
    participants: (typeof schema.chatParticipant.$inferSelect)[];
  }
> {
  const participantIds = input.participants.map((p) => p.userAccountId);

  const memberships = await ctx.tenantScopedDb
    .select({ userAccountId: schema.appUser.userAccountId })
    .from(schema.appUser)
    .where(
      and(
        eq(schema.appUser.tenantId, ctx.tenantId),
        inArray(schema.appUser.userAccountId, participantIds)
      )
    );

  if (memberships.length !== participantIds.length) {
    const error = new Error('One or more participants are not members of this tenant');
    (error as { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const channels = await ctx.tenantScopedDb
    .insert(schema.chatChannel)
    .values({
      tenantId: ctx.tenantId,
      title: input.title,
      createdByUserAccountId: input.createdByUserAccountId,
    })
    .returning();
  const channel = channels[0];

  const participantRows = await ctx.tenantScopedDb
    .insert(schema.chatParticipant)
    .values(
      input.participants.map((p) => ({
        tenantId: ctx.tenantId,
        channelId: channel.id,
        userAccountId: p.userAccountId,
        encryptedChannelKey: p.encryptedChannelKey,
      }))
    )
    .returning();

  return { ...channel, participants: participantRows };
}

export async function getChatChannelById(
  ctx: TenantContext,
  id: string,
  userAccountId: string
): Promise<
  | (typeof schema.chatChannel.$inferSelect & {
      participants: (typeof schema.chatParticipant.$inferSelect)[];
    })
  | undefined
> {
  const rows = await ctx.tenantScopedDb
    .select()
    .from(schema.chatChannel)
    .where(and(eq(schema.chatChannel.tenantId, ctx.tenantId), eq(schema.chatChannel.id, id)))
    .limit(1);

  if (rows.length === 0) return undefined;

  const participants = await ctx.tenantScopedDb
    .select()
    .from(schema.chatParticipant)
    .where(eq(schema.chatParticipant.channelId, id));

  if (!participants.some((p) => p.userAccountId === userAccountId)) {
    return undefined;
  }

  return { ...rows[0], participants };
}

export async function listChatChannelsForUser(
  ctx: TenantContext,
  userAccountId: string
): Promise<
  (typeof schema.chatChannel.$inferSelect & {
    participants: (typeof schema.chatParticipant.$inferSelect)[];
  })[]
> {
  const participantRows = await ctx.tenantScopedDb
    .select({ channelId: schema.chatParticipant.channelId })
    .from(schema.chatParticipant)
    .where(
      and(
        eq(schema.chatParticipant.tenantId, ctx.tenantId),
        eq(schema.chatParticipant.userAccountId, userAccountId)
      )
    );

  const channelIds = participantRows.map((r) => r.channelId);
  if (channelIds.length === 0) return [];

  const channels = await ctx.tenantScopedDb
    .select()
    .from(schema.chatChannel)
    .where(inArray(schema.chatChannel.id, channelIds))
    .orderBy(desc(schema.chatChannel.createdAt));

  const participants = await ctx.tenantScopedDb
    .select()
    .from(schema.chatParticipant)
    .where(inArray(schema.chatParticipant.channelId, channelIds));

  const participantsByChannel = new Map<string, (typeof schema.chatParticipant.$inferSelect)[]>();
  for (const p of participants) {
    const list = participantsByChannel.get(p.channelId) ?? [];
    list.push(p);
    participantsByChannel.set(p.channelId, list);
  }

  return channels.map((c) => ({
    ...c,
    participants: participantsByChannel.get(c.id) ?? [],
  }));
}

async function assertChannelParticipant(
  ctx: TenantContext,
  channelId: string,
  userAccountId: string
): Promise<boolean> {
  const rows = await ctx.tenantScopedDb
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.chatParticipant)
    .where(
      and(
        eq(schema.chatParticipant.tenantId, ctx.tenantId),
        eq(schema.chatParticipant.channelId, channelId),
        eq(schema.chatParticipant.userAccountId, userAccountId)
      )
    )
    .limit(1);
  return rows[0]?.count > 0;
}

export async function createChatMessage(
  ctx: TenantContext,
  input: CreateChatMessageInput
): Promise<typeof schema.chatMessage.$inferSelect> {
  const isParticipant = await assertChannelParticipant(
    ctx,
    input.channelId,
    input.senderUserAccountId
  );
  if (!isParticipant) {
    const error = new Error('You are not a participant in this channel');
    (error as { statusCode?: number }).statusCode = 403;
    throw error;
  }

  const rows = await ctx.tenantScopedDb
    .insert(schema.chatMessage)
    .values({
      tenantId: ctx.tenantId,
      channelId: input.channelId,
      senderUserAccountId: input.senderUserAccountId,
      encryptedPayload: input.encryptedPayload,
    })
    .returning();
  return rows[0];
}

export async function listChatMessages(
  ctx: TenantContext,
  channelId: string,
  userAccountId: string,
  options: ListChatMessagesOptions = {}
): Promise<(typeof schema.chatMessage.$inferSelect)[]> {
  const isParticipant = await assertChannelParticipant(ctx, channelId, userAccountId);
  if (!isParticipant) {
    const error = new Error('You are not a participant in this channel');
    (error as { statusCode?: number }).statusCode = 403;
    throw error;
  }

  const conditions = [
    eq(schema.chatMessage.tenantId, ctx.tenantId),
    eq(schema.chatMessage.channelId, channelId),
  ];
  if (options.before) {
    conditions.push(gt(schema.chatMessage.createdAt, sql`${options.before}`));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.chatMessage)
    .where(and(...conditions))
    .orderBy(desc(schema.chatMessage.createdAt))
    .limit(options.limit ?? 50);
}
