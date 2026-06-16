import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApplyResult, BuildResult, ReviewResult } from './activities';
import { taskRunWorkflow, type TaskRunInput } from './workflows';

describe('taskRunWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  function baseBuild(): BuildResult {
    return { success: true, artifacts: { plan: 'plan', value: 0 }, log: [] };
  }

  function baseInput(overrides: Partial<TaskRunInput> = {}): TaskRunInput {
    return {
      tenantId: '00000000-0000-0000-0000-000000000000',
      userId: '00000000-0000-0000-0000-000000000000',
      jobId: '00000000-0000-0000-0000-000000000001',
      idempotencyKey: 'test-key',
      type: 'echo',
      tier: 0,
      payload: {},
      ...overrides,
    };
  }

  async function runWorkflow(
    workflowId: string,
    input: TaskRunInput,
    activities: Record<string, unknown>
  ) {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: workflowId,
      workflowsPath: path.resolve(__dirname, './workflows.ts'),
      activities,
    });

    return worker.runUntil(
      testEnv.client.workflow.execute(taskRunWorkflow, {
        taskQueue: workflowId,
        workflowId,
        args: [input],
      })
    );
  }

  it('finishes done when the reviewer approves immediately', async () => {
    const result = await runWorkflow('approve-immediately', baseInput(), {
      build: async () => baseBuild(),
      review: async (): Promise<ReviewResult> => ({
        verdict: 'approve',
        approved: true,
        reason: 'looks good',
        findings: [],
      }),
      apply: async (): Promise<ApplyResult> => ({
        applied: true,
        reason: 'applied',
        output: { appliedAt: 'now' },
      }),
      applyPatch: async () => baseBuild(),
      recordFailure: async () => {},
      recordEscalation: async () => {},
    });

    expect(result.status).toBe('done');
    expect(result.review.verdict).toBe('approve');
    expect(result.apply.applied).toBe(true);
  });

  it('applies one patch and then finishes done', async () => {
    const result = await runWorkflow('one-revision', baseInput(), {
      build: async () => baseBuild(),
      review: async (_input: unknown, _draft: unknown, iteration: number): Promise<ReviewResult> => {
        if (iteration === 0) {
          return {
            verdict: 'revise',
            approved: false,
            reason: 'increment value',
            findings: [],
            patch: [{ op: 'replace', path: '/value', value: 1 }],
          };
        }
        return { verdict: 'approve', approved: true, reason: 'revised', findings: [] };
      },
      applyPatch: async (_input: unknown, draft: BuildResult, review: ReviewResult): Promise<BuildResult> => {
        const value = (review.patch?.[0]?.value as number) ?? 0;
        return {
          success: true,
          artifacts: { ...draft.artifacts, value },
          log: [...draft.log, 'patched'],
        };
      },
      apply: async (): Promise<ApplyResult> => ({ applied: true, reason: 'applied', output: { appliedAt: 'now' } }),
      recordFailure: async () => {},
      recordEscalation: async () => {},
    });

    expect(result.status).toBe('done');
    expect(result.apply.output).toMatchObject({ appliedAt: 'now' });
  });

  it('escalates when a cycle is detected', async () => {
    const result = await runWorkflow('cycle', baseInput({ type: 'cycle' }), {
      build: async () => baseBuild(),
      review: async (): Promise<ReviewResult> => ({
        verdict: 'revise',
        approved: false,
        reason: 'no-op revision',
        findings: [],
        patch: [{ op: 'replace', path: '/noop', value: true }],
      }),
      applyPatch: async (_input: unknown, draft: BuildResult): Promise<BuildResult> => draft,
      apply: async (): Promise<ApplyResult> => ({ applied: false, reason: 'not applied', output: {} }),
      recordFailure: async () => {},
      recordEscalation: async () => {},
    });

    expect(result.status).toBe('failed');
    expect(result.apply.reason).toContain('cycle');
  });

  it('escalates when the reviewer requests escalation', async () => {
    const result = await runWorkflow('escalate', baseInput({ type: 'escalate' }), {
      build: async () => baseBuild(),
      review: async (): Promise<ReviewResult> => ({
        verdict: 'escalate',
        approved: false,
        reason: 'human review required',
        findings: [],
      }),
      applyPatch: async () => baseBuild(),
      apply: async (): Promise<ApplyResult> => ({ applied: false, reason: 'not applied', output: {} }),
      recordFailure: async () => {},
      recordEscalation: async () => {},
    });

    expect(result.status).toBe('failed');
    expect(result.review.verdict).toBe('escalate');
  });
});
