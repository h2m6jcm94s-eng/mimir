import { ModelProviderConfig } from '@mimir/shared-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../config';
import { ModelRouter } from '../router';
import { type MockServer, startMockServer } from './test-utils';

function makeGroqConfig(): AppConfig {
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
      1: [{ provider: 'groq' }],
      2: [{ provider: 'groq' }],
    }),
  };
}

const usingRealKey = Boolean(process.env.GROQ_API_KEY);
const originalBaseUrl = process.env.GROQ_BASE_URL;

// When no real API key is available, stand up a local mock server so the test
// still exercises the full Groq provider + router path end-to-end.
if (!usingRealKey) {
  process.env.GROQ_API_KEY = 'test-groq-key';
}

describe('Groq provider integration', () => {
  let server: MockServer | undefined;

  beforeAll(async () => {
    if (usingRealKey) return;

    server = await startMockServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/chat/completions') {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: 'pong' } }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
          })
        );
      });
    });

    process.env.GROQ_BASE_URL = server.baseUrl;
  });

  afterAll(async () => {
    if (usingRealKey) return;

    await server?.close();

    if (originalBaseUrl !== undefined) {
      process.env.GROQ_BASE_URL = originalBaseUrl;
    } else {
      // biome-ignore lint/performance/noDelete: process.env values must be removed, not set to the string "undefined"
      delete process.env.GROQ_BASE_URL;
    }
    // biome-ignore lint/performance/noDelete: process.env values must be removed, not set to the string "undefined"
    delete process.env.GROQ_API_KEY;
  });

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
