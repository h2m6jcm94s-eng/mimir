import { timingSafeEqual } from 'node:crypto';
import { secrets } from '../../config/secrets';
import { redis } from '../../db/redis';
import type { TenantContext } from '../../db/tenant-context';
import { createApproval } from '../../repositories/approval';
import { createAuditEvent } from '../../repositories/audit';
import { createJob, updateJobStatus } from '../../repositories/job';
import { createMessage, createSession, findSessionByExternalId } from '../../repositories/session';
import {
  approvalExpiresAt,
  buildBlastRadius,
  riskFromTier,
} from '../../services/approvals/metadata';
import { evaluateTenantPolicy } from '../../services/governance/engine';
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
  source: 'chat' | 'api' | 'ui' | 'routine';
  prompt: string;
  payload: Record<string, unknown>;
}

export interface ChatJobGateInput {
  tenantId: string;
  actor: string;
  type: string;
  tier: number;
  idempotencyKey: string;
  input: Record<string, unknown>;
  prompt?: string;
}

export async function createChatJobWithPolicyGate(
  ctx: TenantContext,
  input: ChatJobGateInput
): Promise<{ job: { id: string; status: string }; approvalId?: string }> {
  const decision = await evaluateTenantPolicy(ctx, {
    action: input.type,
    tier: input.tier,
    source: 'chat',
  });

  await createAuditEvent(ctx, {
    actor: input.actor,
    action: 'policy_decision',
    tier: input.tier,
    payload: { decision, action: input.type, source: 'chat' } as Record<string, unknown>,
  });

  if (decision.effect === 'deny') {
    throw new Error(`POLICY_VIOLATION: ${decision.reason || 'Chat action denied by policy'}`);
  }

  const job = await createJob(ctx, {
    idempotencyKey: input.idempotencyKey,
    type: input.type,
    tier: input.tier,
    source: 'chat',
    input: input.input,
  });

  if (decision.effect === 'require_approval') {
    const blockedJob = await updateJobStatus(ctx, job.id, 'blocked');
    const approval = await createApproval(ctx, {
      jobId: blockedJob.id,
      requestedBy: input.actor,
      reason: decision.reason,
      risk: riskFromTier(input.tier),
      blastRadius: buildBlastRadius({
        tier: input.tier,
        action: input.type,
        summary: input.prompt,
      }),
      expiresAt: approvalExpiresAt(input.tier),
    });
    await createAuditEvent(ctx, {
      actor: input.actor,
      action: 'approval_requested',
      tier: input.tier,
      payload: { approvalId: approval.id, jobId: blockedJob.id },
    });
    return { job: blockedJob, approvalId: approval.id };
  }

  return { job };
}

export async function startReplyWorkflow(input: ReplyWorkflowInput): Promise<void> {
  await startTaskWorkflow({
    tenantId: input.tenantId,
    userId: input.userId,
    jobId: input.jobId,
    idempotencyKey: input.idempotencyKey,
    type: input.type,
    tier: input.tier,
    source: input.source,
    payload: {
      prompt: input.prompt,
      ...input.payload,
    },
  });
}
