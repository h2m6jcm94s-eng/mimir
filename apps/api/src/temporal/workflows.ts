import { proxyActivities, sleep } from '@temporalio/workflow';
import { stableHash } from '../lib/stable-hash';
import type { ApplyResult, BuildResult, ReviewResult } from './activities';

const activities = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

export interface TaskRunInput {
  tenantId: string;
  userId: string;
  jobId: string;
  idempotencyKey: string;
  type: string;
  tier: number;
  payload: Record<string, unknown>;
}

export interface TaskRunOutput {
  jobId: string;
  status: 'done' | 'failed';
  build: BuildResult;
  review: ReviewResult;
  apply: ApplyResult;
}

export interface RoutineWorkflowInput {
  tenantId: string;
  userId: string;
  routineId: string;
  runId: string;
  jobType: string;
  tier: number;
  payload: Record<string, unknown>;
}

const MAX_REVIEW_ITERATIONS = 3;

export async function taskRunWorkflow(input: TaskRunInput): Promise<TaskRunOutput> {
  const build = await activities.build(input);
  await sleep('50ms');

  let draft: BuildResult = build;
  let finalReview: ReviewResult | undefined;
  const seenDraftHashes = new Set<string>();

  for (let iteration = 0; iteration < MAX_REVIEW_ITERATIONS; iteration++) {
    const draftHash = stableHash(draft.artifacts);
    if (seenDraftHashes.has(draftHash)) {
      await activities.recordEscalation(input, 'review_cycle_detected', 'Draft repeated during review loop');
      return {
        jobId: input.jobId,
        status: 'failed',
        build,
        review: finalReview ?? { verdict: 'escalate', approved: false, reason: 'cycle detected', findings: [] },
        apply: { applied: false, reason: 'cycle detected during review', output: {} },
      };
    }
    seenDraftHashes.add(draftHash);

    const review = await activities.review(input, draft, iteration);
    finalReview = review;

    if (review.verdict === 'approve') {
      break;
    }

    if (review.verdict === 'escalate') {
      await activities.recordEscalation(input, 'review_escalated', review.reason);
      return {
        jobId: input.jobId,
        status: 'failed',
        build,
        review,
        apply: { applied: false, reason: `escalated: ${review.reason}`, output: {} },
      };
    }

    // revision requested
    if (iteration === MAX_REVIEW_ITERATIONS - 1) {
      await activities.recordEscalation(input, 'review_max_iterations', 'Maximum review iterations reached');
      return {
        jobId: input.jobId,
        status: 'failed',
        build,
        review,
        apply: { applied: false, reason: 'maximum review iterations reached', output: {} },
      };
    }

    await sleep('50ms');
    draft = await activities.applyPatch(input, draft, review, iteration);
  }

  if (!finalReview) {
    finalReview = { verdict: 'approve', approved: true, reason: 'no review required', findings: [] };
  }

  await sleep('50ms');
  const apply = await activities.apply(input, draft, finalReview);

  return {
    jobId: input.jobId,
    status: apply.applied ? 'done' : 'failed',
    build,
    review: finalReview,
    apply,
  };
}

export async function routineWorkflow(input: RoutineWorkflowInput): Promise<void> {
  await activities.dispatchRoutine(input);
}
