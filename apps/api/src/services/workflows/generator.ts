import type { WorkflowGraph, WorkflowNode } from '@mimir/shared-types';
import { connectorRegistry } from '../connectors/registry';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function pickActions(description: string, availableActions: string[]): string[] {
  const words = new Set(tokenize(description));
  const scored = availableActions.map((action) => {
    const parts = action.toLowerCase().split(/[.\-_]/);
    const matches = parts.filter((part) => words.has(part)).length;
    return { action, score: matches };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.action);
}

export function generateWorkflow(
  description: string,
  tier: number
): { graph: WorkflowGraph; cron: string } {
  const actions = pickActions(description, connectorRegistry.knownActions());
  const selected = actions.slice(0, 3);

  const trigger: WorkflowNode = {
    id: 'trigger',
    kind: 'trigger',
    label: 'Schedule',
    config: { trigger: 'cron', cron: '0 8 * * *' },
    position: { x: 0, y: 0 },
  };

  const nodes: WorkflowNode[] = [trigger];
  const edges: WorkflowGraph['edges'] = [];
  let previousId = trigger.id;

  for (let index = 0; index < selected.length; index++) {
    const action = selected[index];
    const id = `action-${index}`;
    nodes.push({
      id,
      kind: 'action',
      label: action,
      config: { action, tier, input: {} },
      position: { x: 250, y: index * 100 },
    });
    edges.push({ id: `${previousId}->${id}`, source: previousId, target: id });
    previousId = id;
  }

  return { graph: { nodes, edges }, cron: trigger.config.cron as string };
}
