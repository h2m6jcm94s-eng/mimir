import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@mimir/shared-types';

const CLOUD_KINDS = new Set([
  'telegram',
  'slack',
  'whatsapp',
  'instagram',
  'facebook',
  'gmail',
  'microsoftGraph',
  'airtable',
  'discord',
]);

const LOCAL_KINDS = new Set(['csv', 'xlsx', 'googleSheets']);

function inferTier(action: string): 0 | 1 | 2 {
  const kind = action.split('.')[0];
  if (LOCAL_KINDS.has(kind)) return 1;
  return CLOUD_KINDS.has(kind) ? 2 : 1;
}

function inferRole(action: string): string {
  const kind = action.split('.')[0];
  if (kind === 'github') return 'coder';
  if (['telegram', 'slack', 'discord', 'gmail'].includes(kind)) return 'executor';
  if (['stripe', 'paddle', 'lemonSqueezy'].includes(kind)) return 'researcher';
  return 'executor';
}

export function optimizeWorkflow(graph: WorkflowGraph): {
  graph: WorkflowGraph;
  log: Record<string, unknown>[];
} {
  const log: Record<string, unknown>[] = [];
  const nodeById = new Map<string, WorkflowNode>();

  for (const node of graph.nodes) {
    nodeById.set(node.id, node);
  }

  const validEdges: WorkflowEdge[] = [];
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      log.push({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        removed: 'missing endpoint',
      });
      continue;
    }
    validEdges.push(edge);
  }

  const outgoing = new Map<string, string[]>();
  for (const edge of validEdges) {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }

  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const node of graph.nodes) {
    if (node.kind === 'trigger') {
      reachable.add(node.id);
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const target of outgoing.get(current) ?? []) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  const keptNodes: WorkflowNode[] = [];
  for (const node of graph.nodes) {
    if (reachable.has(node.id)) {
      keptNodes.push(node);
    } else {
      log.push({ nodeId: node.id, kind: node.kind, removed: 'unreachable' });
    }
  }

  const keptNodeIds = new Set(keptNodes.map((n) => n.id));
  const keptEdges = validEdges.filter(
    (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
  );

  const optimizedNodes = keptNodes.map((node): WorkflowNode => {
    if (node.kind !== 'action') return node;
    const action = node.config.action as string;
    if (!action) return node;

    const tier = inferTier(action);
    const role = inferRole(action);
    log.push({ nodeId: node.id, action, suggestedTier: tier, suggestedRole: role });

    return {
      ...node,
      config: { ...node.config, tier, role },
    };
  });

  return { graph: { ...graph, nodes: optimizedNodes, edges: keptEdges }, log };
}
