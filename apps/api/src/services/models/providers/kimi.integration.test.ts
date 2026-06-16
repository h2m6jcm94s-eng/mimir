import { ModelProviderConfig } from '@mimir/shared-types';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../config';
import { ModelRouter } from '../router';

function makeKimiConfig(): AppConfig {
  return {
    port: 3001,
    databaseUrl: '',
    redisUrl: '',
    temporalHost: '',
    logLevel: 'info',
    modelProviders: ModelProviderConfig.parse({
      0: [{ provider: 'local' }],
      1: [{ provider: 'kimi' }],
      2: [{ provider: 'kimi' }],
    }),
  };
}

describe.skipIf(!process.env.KIMI_API_KEY)('Kimi real provider', () => {
  it('invokes the configured Kimi model and returns a non-empty response', async () => {
    const router = new ModelRouter(makeKimiConfig());
    const output = await router.invoke(1, {
      prompt: 'Reply with exactly the word "pong".',
      payload: {},
    });

    expect(output.provider).toBe('kimi');
    expect(output.model).toBe('kimi-for-coding');
    expect(output.tier).toBe(1);
    expect(output.text.length).toBeGreaterThan(0);
  });

  it('reports Kimi as available when KIMI_API_KEY is present', () => {
    const router = new ModelRouter(makeKimiConfig());
    const status = router.status();
    const kimi = status.find((s) => s.provider === 'Kimi');

    expect(kimi).toBeDefined();
    expect(kimi?.available).toBe(true);
  });
});
