import {
  ModelProviderConfig,
  type ModelProviderConfig as ModelProviderConfigType,
} from '@mimir/shared-types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config';
import { ModelRouter } from './router';

function makeConfig(tierOverrides?: Partial<ModelProviderConfigType>): AppConfig {
  return {
    port: 3001,
    databaseUrl: '',
    redisUrl: '',
    temporalHost: '',
    supertokens: { connectionUri: '', apiKey: '' },
    authDomain: '',
    webAppDomain: '',
    logLevel: 'info',
    modelProviders: ModelProviderConfig.parse({
      0: [{ provider: 'local' }],
      1: [{ provider: 'openai' }],
      2: [{ provider: 'openai' }],
      ...tierOverrides,
    }),
  };
}

describe('ModelRouter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-openai-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('routes T0 to the local adapter', async () => {
    const router = new ModelRouter(makeConfig());
    const output = await router.invoke(0, { prompt: 'hello', payload: {} });
    expect(output.tier).toBe(0);
    expect(output.provider).toBe('local');
    expect(output.model).toBe('local');
  });

  it('scrubs PII from prompts and payloads before cloud dispatch', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'redacted' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const router = new ModelRouter(makeConfig());
    await router.invoke(1, {
      prompt: 'Email alice@example.com and SSN 123-45-6789',
      payload: { phone: '555-555-5555', card: '4111 1111 1111 1111' },
    });

    const request = (fetchMock as Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);
    expect(body.messages[0].content).toBe('Email [EMAIL] and SSN [SSN]');
    expect(body.messages[0].content).not.toContain('alice@example.com');

    const logCalls = logSpy.mock.calls.filter((call) =>
      String(call[0]).includes('model_routing_decision')
    );
    expect(logCalls.length).toBeGreaterThan(0);
    const logEntry = JSON.parse(String(logCalls[0][0]));
    expect(logEntry.tier).toBe(1);
    expect(logEntry.providers).toContain('openai');

    logSpy.mockRestore();
  });

  it('routes T1 to the first available provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'T1 response' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(makeConfig());
    const output = await router.invoke(1, { prompt: 'hello', payload: {} });

    expect(output.tier).toBe(1);
    expect(output.provider).toBe('openai');
    expect(output.text).toBe('T1 response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = (fetchMock as Mock).mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: 'Bearer test-openai-key' });
  });

  it('routes T2 to the first available provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'T2 response' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(makeConfig());
    const output = await router.invoke(2, { prompt: 'hello', payload: {} });

    expect(output.tier).toBe(2);
    expect(output.provider).toBe('openai');
    expect(output.text).toBe('T2 response');
  });

  it('falls back to local when the configured provider is unavailable', async () => {
    process.env.OPENAI_API_KEY = undefined;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(makeConfig());
    const output = await router.invoke(1, { prompt: 'hello', payload: {} });

    expect(output.provider).toBe('local');
    expect(output.model).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never returns a cloud response for T0 input', async () => {
    const router = new ModelRouter(makeConfig());
    for (let i = 0; i < 20; i++) {
      const output = await router.invoke(0, { prompt: `hello ${i}`, payload: {} });
      expect(output.provider).not.toBe('openai');
      expect(output.tier).toBe(0);
    }
  });

  it('falls back to local when a cloud provider is configured for T0', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(
      makeConfig({
        0: [{ provider: 'openai', priority: 0 }],
      })
    );

    const output = await router.invoke(0, { prompt: 'hello', payload: {} });
    expect(output.provider).toBe('local');
    expect(output.tier).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows an explicit provider override', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Claude response' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(
      makeConfig({
        2: [
          { provider: 'openai', priority: 0 },
          { provider: 'anthropic', priority: 1 },
        ],
      })
    );
    const output = await router.invoke(
      2,
      { prompt: 'hello', payload: {} },
      { provider: 'anthropic' }
    );

    expect(output.provider).toBe('anthropic');
    expect(output.text).toBe('Claude response');
  });

  it('fails over to the next provider when the first provider fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'openai error',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude failover response' }],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(
      makeConfig({
        2: [
          { provider: 'openai', priority: 0 },
          { provider: 'anthropic', priority: 1 },
        ],
      })
    );
    const output = await router.invoke(2, { prompt: 'hello', payload: {} });

    expect(output.provider).toBe('anthropic');
    expect(output.text).toBe('Claude failover response');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips a provider whose circuit breaker is open', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('openai')) {
        return { ok: false, status: 500, text: async () => 'openai error' };
      }
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude response' }],
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const router = new ModelRouter(
      makeConfig({
        2: [
          { provider: 'openai', priority: 0 },
          { provider: 'anthropic', priority: 1 },
        ],
      })
    );

    // Fail OpenAI three times (default threshold) while Anthropic succeeds.
    for (let i = 0; i < 3; i++) {
      const output = await router.invoke(2, { prompt: `attempt ${i}`, payload: {} });
      expect(output.provider).toBe('anthropic');
    }

    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url: string) => {
      expect(url).not.toContain('openai');
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Claude response after breaker open' }],
        }),
      };
    });

    const output = await router.invoke(2, { prompt: 'hello', payload: {} });

    expect(output.provider).toBe('anthropic');
    expect(output.text).toBe('Claude response after breaker open');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = (fetchMock as Mock).mock.calls[0][0] as string;
    expect(requestUrl).toContain('anthropic');
  });

  it('throws an aggregate error when all providers fail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'provider error',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const router = new ModelRouter(
      makeConfig({
        2: [
          { provider: 'openai', priority: 0 },
          { provider: 'anthropic', priority: 1 },
        ],
      })
    );

    await expect(router.invoke(2, { prompt: 'hello', payload: {} })).rejects.toThrow(
      'All model providers failed for tier 2'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
