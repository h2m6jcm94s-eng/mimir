import { describe, expect, it } from 'vitest';
import { optimizeWorkflow } from './optimizer';

describe('optimizeWorkflow', () => {
  it('keeps reachable nodes, infers tier and role', () => {
    const graph = {
      nodes: [
        { id: 'a', kind: 'trigger' as const, label: 'A', config: {} },
        { id: 'b', kind: 'action' as const, label: 'B', config: { action: 'slack.sendMessage' } },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    };
    const result = optimizeWorkflow(graph);
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.nodes[1].config.tier).toBe(2);
    expect(result.graph.nodes[1].config.role).toBe('executor');
    expect(result.log.some((l) => 'suggestedTier' in l)).toBe(true);
  });

  it('removes unreachable nodes and invalid edges', () => {
    const graph = {
      nodes: [
        { id: 'a', kind: 'trigger' as const, label: 'A', config: {} },
        { id: 'b', kind: 'action' as const, label: 'B', config: {} },
        { id: 'c', kind: 'action' as const, label: 'C', config: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'missing' },
      ],
    };
    const result = optimizeWorkflow(graph);
    expect(result.graph.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.log.some((l) => l.nodeId === 'c' && l.removed === 'unreachable')).toBe(true);
    expect(result.log.some((l) => l.edgeId === 'e2')).toBe(true);
  });
});
