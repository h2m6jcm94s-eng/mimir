import { describe, expect, it } from 'vitest';
import { importN8nWorkflow } from './n8n-importer';

describe('importN8nWorkflow', () => {
  it('maps a schedule trigger and telegram action', () => {
    const workflow = {
      nodes: [
        {
          name: 'Every day',
          type: 'n8n-nodes-base.scheduleTrigger',
          parameters: { rule: { interval: 1, unit: 'days' } },
          position: [100, 200],
        },
        {
          name: 'Send Telegram',
          type: 'n8n-nodes-base.telegram',
          parameters: { chatId: '123', text: 'Hello' },
          position: [300, 200],
        },
      ],
      connections: {
        'Every day': {
          main: [[{ node: 'Send Telegram', type: 'main', index: 0 }]],
        },
      },
    };

    const result = importN8nWorkflow(workflow);
    expect(result.cron).toBe('0 8 */1 * *');
    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.nodes[0].kind).toBe('trigger');
    expect(result.graph.nodes[1].kind).toBe('action');
    expect(result.graph.nodes[1].config.action).toBe('telegram.sendMessage');
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].source).toBe('Every day');
    expect(result.graph.edges[0].target).toBe('Send Telegram');
  });

  it('falls back to custom_code for unmapped nodes', () => {
    const workflow = {
      nodes: [{ name: 'Custom', type: 'n8n-nodes-base.someUnknown', parameters: {} }],
      connections: {},
    };

    const result = importN8nWorkflow(workflow);
    expect(result.graph.nodes[0].kind).toBe('custom_code');
    expect(result.graph.nodes[0].config.n8nType).toBe('n8n-nodes-base.someUnknown');
  });
});
