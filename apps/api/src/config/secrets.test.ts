import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileVaultBackend } from '../services/secrets/vault';
import { EnvSecretResolver, VaultSecretResolver, createSecretResolver } from './secrets';

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

describe('EnvSecretResolver', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets and reads tenant-scoped secrets via environment variables', async () => {
    const resolver = new EnvSecretResolver();
    const tenantId = '00000000-0000-0000-0000-000000000000';

    await resolver.setForTenant(tenantId, 'slack', 'xoxb-secret');

    await expect(resolver.getForTenant(tenantId, 'slack')).resolves.toBe('xoxb-secret');
    expect(process.env[`MIMIR_SECRET_SLACK_${tenantId}`]).toBe('xoxb-secret');
  });
});

describe('VaultSecretResolver', () => {
  it('sets and reads tenant-scoped secrets via the vault backend', async () => {
    const backend = new FileVaultBackend('/tmp/mimir-test-vault.json', 'test-passphrase');
    const resolver = new VaultSecretResolver(backend);
    const tenantId = '00000000-0000-0000-0000-000000000000';

    await resolver.setForTenant(tenantId, 'notion', 'secret_token');

    await expect(resolver.getForTenant(tenantId, 'notion')).resolves.toBe('secret_token');
  });
});
