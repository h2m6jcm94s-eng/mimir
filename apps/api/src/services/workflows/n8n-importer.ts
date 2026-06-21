import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@mimir/shared-types';

interface N8nNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  parameters?: Record<string, unknown>;
  position?: [number, number];
}

interface N8nConnectionTarget {
  node: string;
  type: string;
  index: number;
}

interface N8nWorkflow {
  nodes: N8nNode[];
  connections: Record<string, { main?: N8nConnectionTarget[][] }>;
}

function inferTriggerConfig(node: N8nNode): Record<string, unknown> {
  const params = node.parameters ?? {};
  const rule = (params.rule as Record<string, unknown>) ?? {};
  const interval = Number(rule.interval ?? 1);
  const unit = String(rule.unit ?? 'hours');
  const cron = unit === 'days' ? `0 8 */${interval} * *` : `0 */${interval} * * *`;
  return { trigger: 'cron', cron };
}

function mapN8nNode(node: N8nNode): WorkflowNode {
  const base = {
    id: node.name,
    label: node.name,
    position: node.position ? { x: node.position[0], y: node.position[1] } : undefined,
  };

  switch (node.type) {
    case 'n8n-nodes-base.scheduleTrigger':
      return { ...base, kind: 'trigger' as const, config: inferTriggerConfig(node) };
    case 'n8n-nodes-base.telegram':
      return {
        ...base,
        kind: 'action' as const,
        config: { action: 'telegram.sendMessage', params: node.parameters },
      };
    case 'n8n-nodes-base.slack':
      return {
        ...base,
        kind: 'action' as const,
        config: { action: 'slack.sendMessage', params: node.parameters },
      };
    case 'n8n-nodes-base.httpRequest':
      return {
        ...base,
        kind: 'custom_code' as const,
        config: { n8nType: node.type, params: node.parameters },
      };
    case 'n8n-nodes-base.if':
      return {
        ...base,
        kind: 'condition' as const,
        config: { n8nType: node.type, params: node.parameters },
      };
    default:
      return {
        ...base,
        kind: 'custom_code' as const,
        config: { n8nType: node.type, params: node.parameters },
      };
  }
}

function mapN8nEdges(connections: N8nWorkflow['connections']): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  for (const [sourceName, branches] of Object.entries(connections)) {
    const main = branches?.main;
    if (!Array.isArray(main)) continue;
    main.forEach((branch, branchIndex) => {
      branch.forEach((target, targetIndex) => {
        edges.push({
          id: `${sourceName}->${target.node}-${branchIndex}-${targetIndex}`,
          source: sourceName,
          target: target.node,
          condition: branchIndex === 0 ? undefined : 'false',
        });
      });
    });
  }
  return edges;
}

export function importN8nWorkflow(n8nWorkflowJson: Record<string, unknown>): {
  graph: WorkflowGraph;
  cron: string;
} {
  const workflow = n8nWorkflowJson as unknown as N8nWorkflow;
  const nodes = (workflow.nodes ?? []).map(mapN8nNode);
  const edges = mapN8nEdges(workflow.connections ?? {});

  const trigger = nodes.find((n) => n.kind === 'trigger');
  const cron = (trigger?.config?.cron as string) ?? '';

  return { graph: { nodes, edges }, cron };
}
