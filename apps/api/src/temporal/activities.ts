import type {
  JsonPatchOperation,
  ReviewResult,
} from '@mimir/shared-types';

export type { JsonPatchOperation, ReviewResult } from '@mimir/shared-types';
import { withTenantTransaction } from '../db/tenant-context';
import { createAuditEvent } from '../repositories/audit';
import { addJobCost, getJob, updateJobStatus } from '../repositories/job';
import { BudgetService } from '../services/cost/budget';
import { hashObject } from '../services/diff/ast-diff';
import { ModelRouter } from '../services/models/router';
import { applyPatch as applyJsonPatch } from '../services/patch/json-patch';
import { agentRoleRegistry } from '../services/agents/registry';
import { ApplyRegistry } from '../services/apply/registry';
import { connectorWriteRegistry } from '../services/connectors/write-registry';
import { telegramChatApplyHandler } from '../services/connectors/telegram/handlers';
import { discordChatApplyHandler } from '../services/connectors/discord/handlers';
import { slackChatApplyHandler } from '../services/connectors/slack/handlers';
import '../services/connectors/airtable/handlers';
import '../services/connectors/discord/handlers';
import '../services/connectors/facebook/handlers';
import '../services/connectors/github/apply';
import '../services/connectors/gmail/handlers';
import '../services/connectors/googleContacts/handlers';
import '../services/connectors/googleDocs/handlers';
import '../services/connectors/instagram/handlers';
import '../services/connectors/microsoftGraph/handlers';
import '../services/connectors/pinterest/handlers';
import '../services/connectors/slack/handlers';
import '../services/connectors/telegram/handlers';
import '../services/connectors/whatsapp/handlers';
import { evaluateTenantPolicy } from '../services/governance/engine';
import { ReviewerRouter } from '../services/reviewers/router';
import { scrubForTier } from '../services/scrubber/scrubber';
import { throwIfHalted } from '../services/halt/state';
import { publishJobEvent } from '../services/events/publisher';
import { syncStateToLibSql } from '../services/state/sync';
import type { RoutineWorkflowInput, TaskRunInput } from './workflows';
import { dispatchRoutineJob } from '../services/routines/dispatch';
import { sendEmailDigest } from '../services/email-digest/digest';
import { listDueEmailDigestPreferences } from '../repositories/email-digest';
import { getGlobalDb } from '../db/tenant-context';
import * as schema from '../db/schema';

const budgetService = new BudgetService();

export interface BuildResult {
  success: boolean;
  artifacts: Record<string, unknown>;
  log: string[];
}

export interface ApplyResult {
  applied: boolean;
  reason: string;
  output: Record<string, unknown>;
}

interface ReviewCheckpoint {
  iteration: number;
  result: ReviewResult;
  finishedAt: string;
}

interface PatchCheckpoint {
  iteration: number;
  patch: JsonPatchOperation[];
  result: BuildResult;
  finishedAt: string;
}

interface JobCheckpoint {
  classification?: unknown;
  build?: { result: BuildResult; finishedAt: string };
  reviews?: ReviewCheckpoint[];
  patches?: PatchCheckpoint[];
  apply?: { result: ApplyResult; finishedAt: string };
}

async function syncT0Completion(tier: number, tenantId: string): Promise<void> {
  if (tier !== 0) return;
  await syncStateToLibSql(tenantId);
}

export async function build(input: TaskRunInput): Promise<BuildResult> {
  await throwIfHalted();
  return withTenantTransaction(input.tenantId, async (ctx) => {
    const job = await getJob(ctx, input.jobId);
    const existing = (job?.checkpoint as JobCheckpoint | undefined) ?? {};

    if (existing.build?.result) {
      return existing.build.result;
    }

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: { ...existing, step: 'build', startedAt: new Date().toISOString() },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.running',
      payload: { step: 'build' },
    });

    const scrubbedPayload = scrubForTier(input.payload, input.tier);

    // TODO: wire real build step (sandboxed command, model call, etc.)
    let provider = input.payload.provider as string | undefined;
    let model = input.payload.model as string | undefined;

    const role = input.payload.role as string | undefined;
    if (role) {
      const resolved = await agentRoleRegistry.resolve(ctx, {
        kind: role as 'main' | 'planner' | 'reviewer' | 'coder' | 'researcher' | 'memory' | 'executor' | 'fallback',
        tier: input.tier as 0 | 1 | 2,
      });
      provider = provider ?? resolved.provider;
      model = model ?? resolved.model;
    }

    const router = new ModelRouter();
    const { maxTokens, maxCostUsd, ...restPayload } = input.payload;
    const modelInput = {
      prompt: (restPayload.prompt as string) ?? '',
      payload: restPayload,
    };
    const modelOutput = await router.invoke(input.tier as 0 | 1 | 2, modelInput, {
      provider,
      model,
      maxTokens: maxTokens as number | undefined,
      ctx,
      actor: input.userId,
    });

    const callCostUsd = modelOutput.costUsd ?? 0;
    if (callCostUsd > 0) {
      const updatedJob = await addJobCost(ctx, input.jobId, callCostUsd);
      const totalCostUsd = updatedJob?.costUsd ?? (job?.costUsd ?? 0) + callCostUsd;
      const budget = maxCostUsd as number | undefined;
      if (budget !== undefined && totalCostUsd > budget) {
        throw new Error(
          `Job cost ceiling exceeded: ${totalCostUsd} micro-USD spent vs ${budget} micro-USD budget`
        );
      }
      await budgetService.checkAction(ctx, {
        tier: input.tier,
        projectedCostUsd: callCostUsd,
        actor: input.userId,
      });
    }

    const result: BuildResult = {
      success: true,
      artifacts: { plan: `plan-${input.idempotencyKey}`, model: modelOutput },
      log: ['Build step executed'],
    };

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: {
        ...existing,
        build: { result, scrubbedPayload, finishedAt: new Date().toISOString() },
      },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.build.completed',
      payload: { costUsd: callCostUsd },
    });

    await createAuditEvent(ctx, {
      actor: input.userId,
      action: 'build_completed',
      tier: input.tier,
      payload: { jobId: input.jobId, result },
    });

    return result;
  });
}

export async function review(
  input: TaskRunInput,
  buildResult: BuildResult,
  iteration: number
): Promise<ReviewResult> {
  await throwIfHalted();
  return withTenantTransaction(input.tenantId, async (ctx) => {
    const job = await getJob(ctx, input.jobId);
    const existing = (job?.checkpoint as JobCheckpoint | undefined) ?? {};

    const cached = existing.reviews?.find((r) => r.iteration === iteration);
    if (cached) {
      return cached.result;
    }

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: { ...existing, step: 'review', iteration, startedAt: new Date().toISOString() },
    });

    const reviewer = new ReviewerRouter();
    const result = await reviewer.review({
      prompt: (input.payload.prompt as string) ?? '',
      type: input.type,
      tier: input.tier as 0 | 1 | 2,
      draft: buildResult,
      iteration,
    });

    const reviews: ReviewCheckpoint[] = [
      ...(existing.reviews ?? []),
      { iteration, result, finishedAt: new Date().toISOString() },
    ];

    await updateJobStatus(ctx, input.jobId, result.approved ? 'running' : 'needs_attention', {
      checkpoint: { ...existing, reviews },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.review.completed',
      payload: { iteration, approved: result.approved, verdict: result.verdict },
    });

    await createAuditEvent(ctx, {
      actor: input.userId,
      action: 'review_completed',
      tier: input.tier,
      payload: { jobId: input.jobId, iteration, verdict: result.verdict, reason: result.reason },
    });

    return result;
  });
}

export async function applyPatch(
  input: TaskRunInput,
  currentDraft: BuildResult,
  review: ReviewResult,
  iteration: number
): Promise<BuildResult> {
  await throwIfHalted();
  return withTenantTransaction(input.tenantId, async (ctx) => {
    const job = await getJob(ctx, input.jobId);
    const existing = (job?.checkpoint as JobCheckpoint | undefined) ?? {};

    const cached = existing.patches?.find((p) => p.iteration === iteration);
    if (cached) {
      return cached.result;
    }

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: { ...existing, step: 'applyPatch', iteration, startedAt: new Date().toISOString() },
    });

    const patch = review.patch ?? [];
    const patchedArtifacts = applyJsonPatch(currentDraft.artifacts, patch);

    const result: BuildResult = {
      success: true,
      artifacts: patchedArtifacts,
      log: [...currentDraft.log, `Patch applied for iteration ${iteration}`],
    };

    const patches: PatchCheckpoint[] = [
      ...(existing.patches ?? []),
      { iteration, patch, result, finishedAt: new Date().toISOString() },
    ];

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: { ...existing, patches },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.patch.applied',
      payload: { iteration, patchHash: hashObject(patch) },
    });

    await createAuditEvent(ctx, {
      actor: input.userId,
      action: 'patch_applied',
      tier: input.tier,
      payload: {
        jobId: input.jobId,
        iteration,
        patchHash: hashObject(patch),
        draftHash: hashObject(result.artifacts),
      },
    });

    return result;
  });
}

const applyRegistry = new ApplyRegistry();
for (const descriptor of connectorWriteRegistry.values()) {
  applyRegistry.register(
    `${descriptor.kind}.${descriptor.action}`,
    connectorWriteRegistry.applyHandlerFor(descriptor)
  );
}
applyRegistry.register('telegram.chat', telegramChatApplyHandler);
applyRegistry.register('discord.chat', discordChatApplyHandler);
applyRegistry.register('slack.chat', slackChatApplyHandler);

export async function apply(
  input: TaskRunInput,
  finalDraft: BuildResult,
  reviewResult: ReviewResult
): Promise<ApplyResult> {
  await throwIfHalted();
  const result = await withTenantTransaction(input.tenantId, async (ctx) => {
    const job = await getJob(ctx, input.jobId);
    const existing = (job?.checkpoint as JobCheckpoint | undefined) ?? {};

    if (existing.apply?.result) {
      return existing.apply.result;
    }

    await updateJobStatus(ctx, input.jobId, 'running', {
      checkpoint: { ...existing, step: 'apply', startedAt: new Date().toISOString() },
    });

    const preApplyDecision = await evaluateTenantPolicy(ctx, {
      action: input.type,
      tier: input.tier,
    });

    if (preApplyDecision.effect === 'deny') {
      const reason = preApplyDecision.reason || 'Policy denied at apply time';
      await updateJobStatus(ctx, input.jobId, 'failed', {
        result: { error: 'POLICY_VIOLATION', reason },
        checkpoint: { ...existing, apply: { result: { applied: false, reason, output: {} }, finishedAt: new Date().toISOString() } },
      });
      await createAuditEvent(ctx, {
        actor: input.userId,
        action: 'policy_violation',
        tier: input.tier,
        payload: { jobId: input.jobId, decision: preApplyDecision },
      });
      return { applied: false, reason, output: {} };
    }

    const applyResult = await applyRegistry.handle(ctx, input.type, input, finalDraft, reviewResult);

    await updateJobStatus(ctx, input.jobId, applyResult.applied ? 'done' : 'failed', {
      result: applyResult.output,
      checkpoint: { ...existing, apply: { result: applyResult, finishedAt: new Date().toISOString() } },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: applyResult.applied ? 'job.apply.completed' : 'job.apply.failed',
      payload: { applied: applyResult.applied, reason: applyResult.reason },
    });

    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: applyResult.applied ? 'job.done' : 'job.failed',
      payload: { reason: applyResult.reason },
    });

    await createAuditEvent(ctx, {
      actor: input.userId,
      action: applyResult.applied ? 'apply_completed' : 'apply_failed',
      tier: input.tier,
      payload: { jobId: input.jobId, applied: applyResult.applied, reason: applyResult.reason },
    });

    return applyResult;
  });

  // Sync T0 state to the local LibSQL replica only after the Postgres
  // transaction commits. Running it inside the transaction can deadlock the
  // connection pool because sync opens its own tenant-scoped reads.
  await syncT0Completion(input.tier, input.tenantId);

  return result;
}

export async function recordFailure(
  input: TaskRunInput,
  code: string,
  reason: string
): Promise<void> {
  await withTenantTransaction(input.tenantId, async (ctx) => {
    await updateJobStatus(ctx, input.jobId, 'failed', {
      result: { error: code, reason },
    });
    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.failed',
      payload: { error: code, reason },
    });
  });

  await syncT0Completion(input.tier, input.tenantId);
}

export async function recordEscalation(
  input: TaskRunInput,
  code: string,
  reason: string
): Promise<void> {
  await withTenantTransaction(input.tenantId, async (ctx) => {
    await updateJobStatus(ctx, input.jobId, 'needs_attention', {
      result: { error: code, reason },
    });
    await publishJobEvent(ctx, {
      jobId: input.jobId,
      type: 'job.failed',
      payload: { error: code, reason, escalation: true },
    });
  });
}

export async function dispatchRoutine(input: RoutineWorkflowInput): Promise<void> {
  await withTenantTransaction(input.tenantId, async (ctx) => {
    await dispatchRoutineJob(ctx, input);
  });
}


export async function sendPendingDigests(input: { frequency: 'daily' | 'weekly' }): Promise<void> {
  const now = new Date();
  const windowMs = input.frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);

  const tenants = await getGlobalDb().select({ id: schema.tenant.id }).from(schema.tenant);

  for (const tenant of tenants) {
    await withTenantTransaction(tenant.id, async (ctx) => {
      const due = await listDueEmailDigestPreferences(ctx, input.frequency, windowStart);
      for (const preference of due) {
        await sendEmailDigest(ctx, preference.appUserId, preference, now);
      }
    });
  }
}
