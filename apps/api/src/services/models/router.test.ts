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
});
