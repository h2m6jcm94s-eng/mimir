import { secrets } from '../../config/secrets';
import { setResolvedModelSecret } from './providers/types';

const MODEL_PROVIDERS = ['openai', 'kimi', 'groq', 'qwen', 'anthropic'] as const;

type ModelProvider = (typeof MODEL_PROVIDERS)[number];

const API_KEY_NAMES: Record<ModelProvider, string> = {
  openai: 'OPENAI_API_KEY',
  kimi: 'KIMI_API_KEY',
  groq: 'GROQ_API_KEY',
  qwen: 'QWEN_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

const BASE_URL_NAMES: Record<ModelProvider, string> = {
  openai: 'OPENAI_BASE_URL',
  kimi: 'KIMI_BASE_URL',
  groq: 'GROQ_BASE_URL',
  qwen: 'QWEN_BASE_URL',
  anthropic: 'ANTHROPIC_BASE_URL',
};

function vaultAlias(provider: ModelProvider, suffix: 'api-key' | 'base-url'): string {
  return `model-provider:${provider}:${suffix}`;
}

/**
 * Resolve model-provider credentials from the vault once at startup.
 *
 * Vault aliases follow the pattern `model-provider:{provider}:{api-key|base-url}`
 * (e.g. `model-provider:openai:api-key`). Values from the vault take precedence
 * over environment variables but never mutate `process.env`.
 */
export async function resolveModelProviderSecrets(): Promise<void> {
  for (const provider of MODEL_PROVIDERS) {
    const apiKey = await secrets.get(vaultAlias(provider, 'api-key'));
    setResolvedModelSecret(API_KEY_NAMES[provider], apiKey);
    const baseUrl = await secrets.get(vaultAlias(provider, 'base-url'));
    setResolvedModelSecret(BASE_URL_NAMES[provider], baseUrl);
  }
}
