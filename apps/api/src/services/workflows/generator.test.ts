import { describe, expect, it } from 'vitest';
import { generateWorkflow } from './generator';

describe('generateWorkflow', () => {
  it('creates a trigger and matching action nodes', () => {
    const result = generateWorkflow('Send a slack message every morning', 1);
    expect(result.cron).toBe('0 8 * * *');
    expect(result.graph.nodes[0].kind).toBe('trigger');
    expect(
      result.graph.nodes.some((n) => n.kind === 'action' && n.config.action === 'slack.sendMessage')
    ).toBe(true);
  });

  it('caps at three actions', () => {
    const result = generateWorkflow('telegram slack github every day', 0);
    expect(result.graph.nodes.filter((n) => n.kind === 'action').length).toBeLessThanOrEqual(3);
  });
});
