/**
 * Secrets are never read from `.env` in production.
 * This abstraction allows swapping to a vault (HashiCorp, AWS Secrets Manager, age/pass) later.
 */
export interface SecretResolver {
  get(key: string): Promise<string | undefined>;
}

export class EnvSecretResolver implements SecretResolver {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }
}

export const secrets = new EnvSecretResolver();
