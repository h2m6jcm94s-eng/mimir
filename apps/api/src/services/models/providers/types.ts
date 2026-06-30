import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { TenantContext } from '../../../db/tenant-context';

export interface ProviderInvokeOptions {
  tier: 0 | 1 | 2;
  model?: string;
  maxTokens?: number;
  ctx?: TenantContext;
}

export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedTiers: ReadonlyArray<0 | 1 | 2>;
  /** True when the provider runs on hardware the tenant controls (no external API call). */
  readonly local: boolean;
  setupHint: string;
  isAvailable(): boolean;
  invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput>;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
}

const resolvedSecrets: Record<string, string | undefined> = {};

export function setResolvedModelSecret(name: string, value: string | undefined): void {
  resolvedSecrets[name] = value;
}

export function getEnv(name: string): string | undefined {
  return resolvedSecrets[name] ?? process.env[name];
}
