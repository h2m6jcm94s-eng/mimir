import { describe, expect, it, vi } from 'vitest';
import { MimirLocalProvider } from './mimir-local';

describe('MimirLocalProvider', () => {
  it('injects the Mimir system prompt when none is present', async () => {
    const provider = new MimirLocalProvider('http://localhost:11434');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'Hello from Mimir' } }),
    });
    global.fetch = fetchMock;

    await provider.invoke({ prompt: 'hi', payload: {} }, { tier: 0 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('Mimir');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('hi');
  });

  it('does not duplicate the system prompt', async () => {
    const provider = new MimirLocalProvider('http://localhost:11434');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'ok' } }),
    });
    global.fetch = fetchMock;

    await provider.invoke(
      {
        prompt: '',
        payload: { messages: [{ role: 'system', content: 'Custom' }] },
      },
      { tier: 0 }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe('Custom');
  });
});
