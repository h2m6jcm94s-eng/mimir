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
import { ApplyRegistry } from '../services/apply/registry';
import { connectorWriteRegistry } from '../services/connectors/write-registry';
import '../services/connectors/facebook/handlers';
import '../services/connectors/github/apply';
import '../services/connectors/instagram/handlers';
import '../services/connectors/pinterest/handlers';
import '../services/connectors/telegram/handlers';
import '../services/connectors/whatsapp/handlers';
import { evaluateTenantPolicy } from '../services/governance/engine';
import { ReviewerRouter } from '../services/reviewers/router';
import { scrubForTier } from '../services/scrubber/scrubber';
import { throwIfHalted } from '../services/halt/state';
import type { TaskRunInput } from './workflows';

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

    const scrubbedPayload = input.tier === 2 ? scrubForTier(input.payload, input.tier) : undefined;

    // TODO: wire real build step (sandboxed command, model call, etc.)
    const router = new ModelRouter();
    const { provider, model, maxTokens, maxCostUsd, ...restPayload } = input.payload;
    const modelInput = {
      prompt: (restPayload.prompt as string) ?? '',
      payload: input.tier === 2 ? (scrubbedPayload as Record<string, unknown>) : restPayload,
    };
    const modelOutput = await router.invoke(input.tier as 0 | 1 | 2, modelInput, {
      provider: provider as string | undefined,
      model: model as string | undefined,
      maxTokens: maxTokens as number | undefined,
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

export async function apply(
  input: TaskRunInput,
  finalDraft: BuildResult,
  reviewResult: ReviewResult
): Promise<ApplyResult> {
  await throwIfHalted();
  return withTenantTransaction(input.tenantId, async (ctx) => {
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

    const result = await applyRegistry.handle(ctx, input.type, input, finalDraft, reviewResult);

    await updateJobStatus(ctx, input.jobId, result.applied ? 'done' : 'failed', {
      result: result.output,
      checkpoint: { ...existing, apply: { result, finishedAt: new Date().toISOString() } },
    });

    await createAuditEvent(ctx, {
      actor: input.userId,
      action: result.applied ? 'apply_completed' : 'apply_failed',
      tier: input.tier,
      payload: { jobId: input.jobId, applied: result.applied, reason: result.reason },
    });

    return result;
  });
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
  });
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
  });
}
