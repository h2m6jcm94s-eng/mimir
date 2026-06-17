import type { ModelInput, ModelOutput } from '@mimir/shared-types';

export interface ProviderInvokeOptions {
  tier: 0 | 1 | 2;
  model?: string;
  maxTokens?: number;
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

export function getEnv(name: string): string | undefined {
  return process.env[name];
}
