import { beforeEach, describe, expect, it, vi } from 'vitest';
import { secrets } from '../../config/secrets';
import { getEnv } from './providers/types';
import { resolveModelProviderSecrets } from './secrets';

vi.mock('../../config/secrets', () => ({
  secrets: { get: vi.fn() },
}));

const getSecret = vi.mocked(secrets.get);

describe('resolveModelProviderSecrets', () => {
  beforeEach(() => {
    getSecret.mockReset();
    vi.unstubAllEnvs();
  });

  it('resolves vault aliases into the provider credential cache', async () => {
    getSecret.mockImplementation(async (key: string) => {
      if (key === 'model-provider:openai:api-key') return 'vault-openai-key';
      if (key === 'model-provider:openai:base-url') return 'https://vault.openai.example';
      return undefined;
    });

    await resolveModelProviderSecrets();

    expect(getEnv('OPENAI_API_KEY')).toBe('vault-openai-key');
    expect(getEnv('OPENAI_BASE_URL')).toBe('https://vault.openai.example');
  });

  it('falls back to environment variables when the vault alias is absent', async () => {
    getSecret.mockResolvedValue(undefined);
    vi.stubEnv('GROQ_API_KEY', 'env-groq-key');

    await resolveModelProviderSecrets();

    expect(getEnv('GROQ_API_KEY')).toBe('env-groq-key');
  });
});
