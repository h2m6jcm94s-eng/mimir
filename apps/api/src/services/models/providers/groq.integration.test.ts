import { ModelProviderConfig } from '@mimir/shared-types';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../config';
import { ModelRouter } from '../router';

function makeGroqConfig(): AppConfig {
  return {
    port: 3001,
    databaseUrl: '',
    redisUrl: '',
    temporalHost: '',
    logLevel: 'info',
    modelProviders: ModelProviderConfig.parse({
      0: [{ provider: 'local' }],
      1: [{ provider: 'groq' }],
      2: [{ provider: 'groq' }],
    }),
  };
}

describe.skipIf(!process.env.GROQ_API_KEY)('Groq real provider', () => {
  it('invokes the configured Groq model and returns a non-empty response', async () => {
    const router = new ModelRouter(makeGroqConfig());
    const output = await router.invoke(1, {
      prompt: 'Reply with exactly the word "pong".',
      payload: {},
    });

    expect(output.provider).toBe('groq');
    expect(output.tier).toBe(1);
    expect(output.text.length).toBeGreaterThan(0);
  });

  it('reports Groq as available when GROQ_API_KEY is present', () => {
    const router = new ModelRouter(makeGroqConfig());
    const status = router.status();
    const groq = status.find((s) => s.provider === 'Groq');

    expect(groq).toBeDefined();
    expect(groq?.available).toBe(true);
  });
});
