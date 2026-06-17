import { ModelProviderConfig } from '@mimir/shared-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../config';
import { ModelRouter } from '../router';
import { type MockServer, startMockServer } from './test-utils';

function makeKimiConfig(): AppConfig {
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
      1: [{ provider: 'kimi' }],
      2: [{ provider: 'kimi' }],
    }),
  };
}

const usingRealKey = Boolean(process.env.KIMI_API_KEY);
const originalBaseUrl = process.env.KIMI_BASE_URL;

// When no real API key is available, stand up a local mock server so the test
// still exercises the full Kimi provider + router path end-to-end.
if (!usingRealKey) {
  process.env.KIMI_API_KEY = 'sk-kimi-test';
}

describe('Kimi provider integration', () => {
  let server: MockServer | undefined;

  beforeAll(async () => {
    if (usingRealKey) return;

    server = await startMockServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/messages') {
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
            content: [{ type: 'text', text: 'pong' }],
            usage: { input_tokens: 2, output_tokens: 1 },
          })
        );
      });
    });

    process.env.KIMI_BASE_URL = server.baseUrl;
  });

  afterAll(async () => {
    if (usingRealKey) return;

    await server?.close();

    if (originalBaseUrl !== undefined) {
      process.env.KIMI_BASE_URL = originalBaseUrl;
    } else {
      // biome-ignore lint/performance/noDelete: process.env values must be removed, not set to the string "undefined"
      delete process.env.KIMI_BASE_URL;
    }
    // biome-ignore lint/performance/noDelete: process.env values must be removed, not set to the string "undefined"
    delete process.env.KIMI_API_KEY;
  });

  it('invokes the configured Kimi model and returns a non-empty response', async () => {
    const router = new ModelRouter(makeKimiConfig());
    const output = await router.invoke(1, {
      prompt: 'Reply with exactly the word "pong".',
      payload: {},
    });

    expect(output.provider).toBe('kimi');
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
