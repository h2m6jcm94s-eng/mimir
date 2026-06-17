import { defineConfig, devices } from '@playwright/test';

const DEFAULT_DATABASE_URL = 'postgresql://mimir_app:mimir_app@localhost:5432/mimir';

/**
 * Mimir end-to-end test configuration.
 *
 * Goals:
 * - Simulate real users clicking through the Next.js app.
 * - Verify the API and Temporal wiring that backs those clicks.
 * - Stay self-contained: start the API, Temporal worker, and web servers
 *   automatically, run migrations before the first test, and clean up afterwards.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  use: {
    baseURL: process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @mimir/api dev',
      url: 'http://localhost:3001/livez',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3001',
        DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        TEMPORAL_HOST: process.env.TEMPORAL_HOST || 'localhost:7233',
        TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue',
        LOG_LEVEL: 'warn',
        SUPERTOKENS_CONNECTION_URI:
          process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
        SUPERTOKENS_API_KEY: process.env.SUPERTOKENS_API_KEY || 'change-me-in-production',
        AUTH_DOMAIN: process.env.AUTH_DOMAIN || 'http://localhost:3001',
        WEB_APP_DOMAIN: process.env.WEB_APP_DOMAIN || 'http://localhost:3000',
        // Model-agnostic e2e defaults: run against local stub so tests pass
        // without real API keys. Set MODEL_PROVIDER_T* env vars to exercise
        // a live provider in a targeted run.
        KIMI_API_KEY: process.env.KIMI_API_KEY || '',
        KIMI_BASE_URL: process.env.KIMI_BASE_URL || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        GROQ_API_KEY: process.env.GROQ_API_KEY || '',
        GROQ_BASE_URL: process.env.GROQ_BASE_URL || '',
        MODEL_PROVIDER_T0: process.env.MODEL_PROVIDER_T0 || 'local',
        MODEL_PROVIDER_T1: process.env.MODEL_PROVIDER_T1 || 'local',
        MODEL_PROVIDER_T2: process.env.MODEL_PROVIDER_T2 || 'local',
      },
    },
    {
      command: 'pnpm --filter @mimir/api worker',
      url: 'http://localhost:3002/readyz',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
        TEMPORAL_HOST: process.env.TEMPORAL_HOST || 'localhost:7233',
        TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || 'mimir-task-queue',
        WORKER_HEALTH_PORT: '3002',
        LOG_LEVEL: 'warn',
        SUPERTOKENS_CONNECTION_URI:
          process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
        SUPERTOKENS_API_KEY: process.env.SUPERTOKENS_API_KEY || 'change-me-in-production',
        AUTH_DOMAIN: process.env.AUTH_DOMAIN || 'http://localhost:3001',
        WEB_APP_DOMAIN: process.env.WEB_APP_DOMAIN || 'http://localhost:3000',
        // Model-agnostic worker defaults: local stub unless overridden.
        KIMI_API_KEY: process.env.KIMI_API_KEY || '',
        KIMI_BASE_URL: process.env.KIMI_BASE_URL || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        GROQ_API_KEY: process.env.GROQ_API_KEY || '',
        GROQ_BASE_URL: process.env.GROQ_BASE_URL || '',
        MODEL_PROVIDER_T0: process.env.MODEL_PROVIDER_T0 || 'local',
        MODEL_PROVIDER_T1: process.env.MODEL_PROVIDER_T1 || 'local',
        MODEL_PROVIDER_T2: process.env.MODEL_PROVIDER_T2 || 'local',
      },
    },
    {
      command: 'pnpm --filter @mimir/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: '3000',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
        PLAYWRIGHT_TEST: 'true',
        NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true',
      },
    },
  ],
});
