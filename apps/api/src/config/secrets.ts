import {
  FileVaultBackend,
  HashiCorpVaultBackend,
  type VaultBackend,
  VaultError,
} from '../services/secrets/vault';

/**
 * Secrets are never read from `.env` in production.
 * This abstraction allows swapping to a vault (HashiCorp, file-encrypted, etc.)
 * while keeping a local env fallback for development.
 */
export interface SecretResolver {
  get(key: string): Promise<string | undefined>;
  getForTenant(tenantId: string, alias: string): Promise<string | undefined>;
}

export function createVaultBackend(): VaultBackend | undefined {
  const vaultAddr = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;
  if (vaultAddr && vaultToken) {
    return new HashiCorpVaultBackend(
      vaultAddr,
      vaultToken,
      process.env.VAULT_MOUNT,
      process.env.VAULT_PATH_PREFIX
    );
  }

  const vaultFile = process.env.VAULT_FILE_PATH;
  const vaultPassphrase = process.env.VAULT_FILE_PASSPHRASE;
  if (vaultFile && vaultPassphrase) {
    return new FileVaultBackend(vaultFile, vaultPassphrase);
  }

  return undefined;
}

export class VaultSecretResolver implements SecretResolver {
  constructor(private backend: VaultBackend) {}

  async get(key: string): Promise<string | undefined> {
    return this.backend.get(key);
  }

  async getForTenant(tenantId: string, alias: string): Promise<string | undefined> {
    return this.backend.get(`tenant:${tenantId}:${alias}`);
  }
}

export class EnvSecretResolver implements SecretResolver {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async getForTenant(tenantId: string, alias: string): Promise<string | undefined> {
    return process.env[`MIMIR_SECRET_${alias.toUpperCase()}_${tenantId}`];
  }
}

export class ChainedSecretResolver implements SecretResolver {
  constructor(private resolvers: SecretResolver[]) {}

  async get(key: string): Promise<string | undefined> {
    for (const resolver of this.resolvers) {
      try {
        const value = await resolver.get(key);
        if (value !== undefined) return value;
      } catch (error) {
        if (error instanceof VaultError) throw error;
        // Fall through to the next resolver on transient errors.
      }
    }
    return undefined;
  }

  async getForTenant(tenantId: string, alias: string): Promise<string | undefined> {
    for (const resolver of this.resolvers) {
      try {
        const value = await resolver.getForTenant(tenantId, alias);
        if (value !== undefined) return value;
      } catch (error) {
        if (error instanceof VaultError) throw error;
      }
    }
    return undefined;
  }
}

export function createSecretResolver(): SecretResolver {
  const vault = createVaultBackend();
  if (vault) {
    return new ChainedSecretResolver([new VaultSecretResolver(vault), new EnvSecretResolver()]);
  }
  return new EnvSecretResolver();
}

export const secrets = createSecretResolver();
