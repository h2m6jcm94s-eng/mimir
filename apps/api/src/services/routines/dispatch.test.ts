import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../db/tenant-context';
import { dispatchRoutineJob } from './dispatch';
import { NodeUnavailableError } from './node-check';

const mocks = vi.hoisted(() => ({
  getRoutineById: vi.fn(),
  updateRoutineRunStatus: vi.fn(),
  updateRoutineRun: vi.fn(),
  createJob: vi.fn(),
  startTaskWorkflow: vi.fn(),
  executeWorkflowGraph: vi.fn(),
  assertNodeAvailable: vi.fn(),
  recordTargetNode: vi.fn((metadata, node) => ({
    ...(metadata ?? {}),
    ...(node ? { targetNodeId: node.id, targetNodeStatus: node.status } : {}),
  })),
}));

vi.mock('../../repositories/routine', () => ({
  getRoutineById: mocks.getRoutineById,
  updateRoutineRunStatus: mocks.updateRoutineRunStatus,
  updateRoutineRun: mocks.updateRoutineRun,
}));

vi.mock('../../repositories/job', () => ({
  createJob: mocks.createJob,
}));

vi.mock('../../temporal/client', () => ({
  startTaskWorkflow: mocks.startTaskWorkflow,
}));

vi.mock('../workflows/executor', () => ({
  executeWorkflowGraph: mocks.executeWorkflowGraph,
}));

vi.mock('./node-check', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    assertNodeAvailable: mocks.assertNodeAvailable,
    recordTargetNode: mocks.recordTargetNode,
  };
});

function ctx(): TenantContext {
  return { tenantId: 'tenant-1' } as TenantContext;
}

function input(overrides?: Partial<Parameters<typeof dispatchRoutineJob>[1]>) {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    routineId: 'routine-1',
    runId: 'run-1',
    jobType: 'test.job',
    tier: 1,
    payload: {},
    ...overrides,
  };
}

describe('dispatchRoutineJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when the routine is not found', async () => {
    mocks.getRoutineById.mockResolvedValue(undefined);

    await dispatchRoutineJob(ctx(), input());

    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'failed',
      expect.objectContaining({ code: 'ROUTINE_NOT_FOUND' })
    );
  });

  it('fails when the routine is disabled', async () => {
    mocks.getRoutineById.mockResolvedValue({ id: 'routine-1', enabled: false });

    await dispatchRoutineJob(ctx(), input());

    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'failed',
      expect.objectContaining({ code: 'ROUTINE_DISABLED' })
    );
  });

  it('fails when the assigned node is unavailable', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: 'node-1',
      workflowJson: null,
    });
    mocks.assertNodeAvailable.mockRejectedValue(new NodeUnavailableError('node-1', 'down'));

    await dispatchRoutineJob(ctx(), input());

    expect(mocks.assertNodeAvailable).toHaveBeenCalledWith(expect.anything(), 'node-1');
    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'failed',
      expect.objectContaining({ code: 'NODE_UNAVAILABLE' })
    );
    expect(mocks.updateRoutineRun).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      expect.objectContaining({ metadata: { targetNodeId: 'node-1', targetNodeStatus: 'down' } })
    );
  });

  it('executes the workflow graph when the routine has one', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: 'node-1',
      workflowJson: { nodes: [], edges: [] },
    });
    mocks.assertNodeAvailable.mockResolvedValue({ id: 'node-1', name: 'Node', status: 'up' });

    await dispatchRoutineJob(ctx(), input());

    expect(mocks.executeWorkflowGraph).toHaveBeenCalledWith(expect.anything(), input());
  });

  it('creates a job and starts the task workflow for non-workflow routines', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: 'node-1',
      workflowJson: null,
    });
    mocks.assertNodeAvailable.mockResolvedValue({ id: 'node-1', name: 'Node', status: 'up' });
    mocks.createJob.mockResolvedValue({ id: 'job-1' });

    await dispatchRoutineJob(ctx(), input());

    expect(mocks.createJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'test.job', source: 'routine' })
    );
    expect(mocks.startTaskWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', type: 'test.job' })
    );
    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(expect.anything(), 'run-1', 'done');
  });
});
