import { ModelProviderConfig } from '@mimir/shared-types';
import type { ProviderId } from '@mimir/shared-types';

export interface SupertokensConfig {
  connectionUri: string;
  apiKey: string;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  temporalHost: string;
  supertokens: SupertokensConfig;
  authDomain: string;
  webAppDomain: string;
  logLevel: string;
  modelProviders: ModelProviderConfig;
}

function parseProviderList(value: string | undefined): { provider: ProviderId; model?: string }[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [provider, ...modelParts] = entry.split(':');
      const model = modelParts.length > 0 ? modelParts.join(':') : undefined;
      return { provider: provider as ProviderId, model };
    });
}

function loadModelProviderConfig(): ModelProviderConfig {
  const raw = {
    0: parseProviderList(process.env.MODEL_PROVIDER_T0),
    1: parseProviderList(process.env.MODEL_PROVIDER_T1),
    2: parseProviderList(process.env.MODEL_PROVIDER_T2),
  };

  // Fall back to sensible defaults when nothing is configured.
  if (raw[0].length === 0 && raw[1].length === 0 && raw[2].length === 0) {
    return ModelProviderConfig.parse({
      0: [{ provider: 'local' }],
      1: [{ provider: 'openai' }, { provider: 'kimi' }, { provider: 'groq' }],
      2: [{ provider: 'openai' }, { provider: 'kimi' }, { provider: 'groq' }],
    });
  }

  return ModelProviderConfig.parse(raw);
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || 3001,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mimir',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    temporalHost: process.env.TEMPORAL_HOST || 'localhost:7233',
    supertokens: {
      connectionUri: process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
      apiKey: process.env.SUPERTOKENS_API_KEY || '',
    },
    authDomain: process.env.AUTH_DOMAIN || 'http://localhost:3001',
    webAppDomain: process.env.WEB_APP_DOMAIN || 'http://localhost:3000',
    logLevel: process.env.LOG_LEVEL || 'info',
    modelProviders: loadModelProviderConfig(),
  };
}
