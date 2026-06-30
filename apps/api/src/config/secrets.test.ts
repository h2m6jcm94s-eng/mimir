import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSecretResolver } from './secrets';

describe('createSecretResolver', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production when no vault is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VAULT_ADDR', '');
    vi.stubEnv('VAULT_TOKEN', '');
    vi.stubEnv('VAULT_FILE_PATH', '');
    vi.stubEnv('VAULT_FILE_PASSPHRASE', '');

    expect(() => createSecretResolver()).toThrow('A secrets vault is required in production');
  });

  it('falls back to environment variables outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VAULT_ADDR', '');
    vi.stubEnv('VAULT_TOKEN', '');
    vi.stubEnv('VAULT_FILE_PATH', '');
    vi.stubEnv('VAULT_FILE_PASSPHRASE', '');
    vi.stubEnv('SOME_TEST_SECRET', 'from-env');

    const resolver = createSecretResolver();
    await expect(resolver.get('SOME_TEST_SECRET')).resolves.toBe('from-env');
  });
});
