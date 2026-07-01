import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../db/tenant-context';
import { NodeUnavailableError } from '../routines/node-check';
import { executeWorkflowGraph } from './executor';

const mocks = vi.hoisted(() => ({
  getRoutineById: vi.fn(),
  updateRoutineRunStatus: vi.fn(),
  updateRoutineRun: vi.fn(),
  runAction: vi.fn(),
  assertNodeAvailable: vi.fn(),
  createJob: vi.fn(),
  updateJobStatus: vi.fn((_, job) => job),
  createApproval: vi.fn(),
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
  updateJobStatus: mocks.updateJobStatus,
}));

vi.mock('../../repositories/approval', () => ({
  createApproval: mocks.createApproval,
}));

vi.mock('../connectors/registry', () => ({
  connectorRegistry: { runAction: mocks.runAction },
}));

vi.mock('../routines/node-check', async (importOriginal) => {
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

function input() {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    routineId: 'routine-1',
    runId: 'run-1',
  };
}

describe('executeWorkflowGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when the assigned node is unavailable', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: 'node-1',
      tier: 1,
      workflowJson: { nodes: [], edges: [] },
    });
    mocks.assertNodeAvailable.mockRejectedValue(new NodeUnavailableError('node-1', 'down'));

    await executeWorkflowGraph(ctx(), input());

    expect(mocks.assertNodeAvailable).toHaveBeenCalledWith(expect.anything(), 'node-1');
    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'failed',
      expect.objectContaining({ code: 'NODE_UNAVAILABLE' })
    );
  });

  it('executes trigger and action nodes when the node is available', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: 'node-1',
      tier: 1,
      workflowJson: {
        nodes: [
          { id: 'trigger-1', kind: 'trigger', label: 'Start', config: {} },
          {
            id: 'action-1',
            kind: 'action',
            label: 'Send message',
            config: { action: 'slack.postMessage', input: { channel: '#general' }, tier: 1 },
          },
        ],
        edges: [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }],
      },
    });
    mocks.assertNodeAvailable.mockResolvedValue({ id: 'node-1', name: 'Node', status: 'up' });
    mocks.runAction.mockResolvedValue({ success: true, result: { ok: true } });

    await executeWorkflowGraph(ctx(), input());

    expect(mocks.runAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'slack',
        action: 'postMessage',
        input: { channel: '#general' },
      })
    );
    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'done',
      undefined
    );
  });

  it('marks the run failed when an action node fails', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: null,
      tier: 1,
      workflowJson: {
        nodes: [
          { id: 'trigger-1', kind: 'trigger', label: 'Start', config: {} },
          {
            id: 'action-1',
            kind: 'action',
            label: 'Bad action',
            config: { action: 'invalid', input: {} },
          },
        ],
        edges: [],
      },
    });
    mocks.assertNodeAvailable.mockResolvedValue(undefined);

    await executeWorkflowGraph(ctx(), input());

    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'failed',
      expect.objectContaining({ code: 'NODE_FAILED' })
    );
  });

  it('blocks custom_code nodes and creates an approval', async () => {
    mocks.getRoutineById.mockResolvedValue({
      id: 'routine-1',
      enabled: true,
      nodeId: null,
      tier: 1,
      workflowJson: {
        nodes: [
          { id: 'trigger-1', kind: 'trigger', label: 'Start', config: {} },
          {
            id: 'code-1',
            kind: 'custom_code',
            label: 'Transform',
            config: { code: 'const x = 1 + 1;', run: { command: 'echo', args: ['ok'] } },
          },
        ],
        edges: [{ id: 'edge-1', source: 'trigger-1', target: 'code-1' }],
      },
    });
    mocks.assertNodeAvailable.mockResolvedValue(undefined);
    mocks.createJob.mockResolvedValue({ id: 'job-1', tier: 1 });
    mocks.createApproval.mockResolvedValue({ id: 'approval-1' });

    await executeWorkflowGraph(ctx(), input());

    expect(mocks.createJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'custom_code' })
    );
    expect(mocks.createApproval).toHaveBeenCalled();
    expect(mocks.updateRoutineRunStatus).toHaveBeenCalledWith(
      expect.anything(),
      'run-1',
      'done',
      undefined
    );
  });
});
