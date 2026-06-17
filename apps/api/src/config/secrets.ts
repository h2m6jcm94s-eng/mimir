/**
 * Secrets are never read from `.env` in production.
 * This abstraction allows swapping to a vault (HashiCorp, AWS Secrets Manager, age/pass) later.
 */
export interface SecretResolver {
  get(key: string): Promise<string | undefined>;
  getForTenant(tenantId: string, alias: string): Promise<string | undefined>;
}

export class EnvSecretResolver implements SecretResolver {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async getForTenant(tenantId: string, alias: string): Promise<string | undefined> {
    return process.env[`MIMIR_SECRET_${alias.toUpperCase()}_${tenantId}`];
  }
}

export const secrets = new EnvSecretResolver();
