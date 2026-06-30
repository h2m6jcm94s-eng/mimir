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
export class MissingSecretError extends Error {
  constructor(key: string) {
    super(`Missing required secret: ${key}`);
    this.name = 'MissingSecretError';
  }
}

export interface SecretResolver {
  get(key: string): Promise<string | undefined>;
  getForTenant(tenantId: string, alias: string): Promise<string | undefined>;
  getRequired(key: string): Promise<string>;
  getRequiredForTenant(tenantId: string, alias: string): Promise<string>;
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

  async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) throw new MissingSecretError(key);
    return value;
  }

  async getRequiredForTenant(tenantId: string, alias: string): Promise<string> {
    const value = await this.getForTenant(tenantId, alias);
    if (value === undefined) throw new MissingSecretError(`tenant:${tenantId}:${alias}`);
    return value;
  }
}

export class EnvSecretResolver implements SecretResolver {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async getForTenant(tenantId: string, alias: string): Promise<string | undefined> {
    return process.env[`MIMIR_SECRET_${alias.toUpperCase()}_${tenantId}`];
  }

  async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) throw new MissingSecretError(key);
    return value;
  }

  async getRequiredForTenant(tenantId: string, alias: string): Promise<string> {
    const value = await this.getForTenant(tenantId, alias);
    if (value === undefined) throw new MissingSecretError(`tenant:${tenantId}:${alias}`);
    return value;
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

  async getRequired(key: string): Promise<string> {
    for (const resolver of this.resolvers) {
      try {
        const value = await resolver.get(key);
        if (value !== undefined) return value;
      } catch (error) {
        if (error instanceof VaultError) throw error;
      }
    }
    throw new MissingSecretError(key);
  }

  async getRequiredForTenant(tenantId: string, alias: string): Promise<string> {
    for (const resolver of this.resolvers) {
      try {
        const value = await resolver.getForTenant(tenantId, alias);
        if (value !== undefined) return value;
      } catch (error) {
        if (error instanceof VaultError) throw error;
      }
    }
    throw new MissingSecretError(`tenant:${tenantId}:${alias}`);
  }
}

export function createSecretResolver(): SecretResolver {
  const vault = createVaultBackend();
  if (vault) {
    return new ChainedSecretResolver([new VaultSecretResolver(vault), new EnvSecretResolver()]);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'A secrets vault is required in production. Set VAULT_ADDR+VAULT_TOKEN or VAULT_FILE_PATH+VAULT_FILE_PASSPHRASE.'
    );
  }
  return new EnvSecretResolver();
}

let _resolver: SecretResolver | undefined;

function getResolver(): SecretResolver {
  if (!_resolver) {
    _resolver = createSecretResolver();
  }
  return _resolver;
}

/**
 * Lazy singleton secret resolver.
 *
 * Deferring instantiation lets the module be imported in tests without
 * requiring a vault, while still failing fast at runtime in production if
 * one is not configured.
 */
export const secrets: SecretResolver = {
  get: (key) => getResolver().get(key),
  getForTenant: (tenantId, alias) => getResolver().getForTenant(tenantId, alias),
  getRequired: (key) => getResolver().getRequired(key),
  getRequiredForTenant: (tenantId, alias) => getResolver().getRequiredForTenant(tenantId, alias),
};
