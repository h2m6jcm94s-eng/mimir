import { timingSafeEqual } from 'node:crypto';
import { secrets } from '../../config/secrets';
import { redis } from '../../db/redis';
import type { TenantContext } from '../../db/tenant-context';
import { createMessage, createSession, findSessionByExternalId } from '../../repositories/session';
import { startTaskWorkflow } from '../../temporal/client';

export async function verifySecretToken(
  headerToken: string | undefined,
  tenantId: string,
  alias: string
): Promise<boolean> {
  if (!headerToken) return false;
  const expected = await secrets.getForTenant(tenantId, alias);
  if (!expected) return false;

  const headerLen = Buffer.byteLength(headerToken);
  const expectedLen = Buffer.byteLength(expected);
  if (headerLen !== expectedLen) return false;

  return timingSafeEqual(Buffer.from(headerToken), Buffer.from(expected));
}

export async function dedupeUpdate(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

export async function findOrCreateChatSession(
  ctx: TenantContext,
  source: string,
  externalId: string
): Promise<{ id: string; source: string; externalId: string | null }> {
  let session = await findSessionByExternalId(ctx, source, externalId);
  if (!session) {
    session = await createSession(ctx, { source, externalId });
  }
  return session;
}

export async function storeUserMessage(
  ctx: TenantContext,
  sessionId: string,
  text: string,
  options: { platformMessageId?: string; tier?: number } = {}
): Promise<void> {
  await createMessage(ctx, {
    sessionId,
    role: 'user',
    content: text,
    platformMessageId: options.platformMessageId,
    tier: options.tier,
  });
}

export function buildChatPrompt(
  source: string,
  history: { role: string; content: string }[],
  incomingText: string
): string {
  const context = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are Mimir, a helpful personal AI assistant. The user is messaging you from ${source}.\n\nConversation history:\n${context}\n\nUser: ${incomingText}\n\nRespond concisely and helpfully as Mimir.`;
}

export interface ReplyWorkflowInput {
  tenantId: string;
  userId: string;
  jobId: string;
  idempotencyKey: string;
  type: string;
  tier: number;
  prompt: string;
  payload: Record<string, unknown>;
}

export async function startReplyWorkflow(input: ReplyWorkflowInput): Promise<void> {
  await startTaskWorkflow({
    tenantId: input.tenantId,
    userId: input.userId,
    jobId: input.jobId,
    idempotencyKey: input.idempotencyKey,
    type: input.type,
    tier: input.tier,
    payload: {
      prompt: input.prompt,
      ...input.payload,
    },
  });
}
