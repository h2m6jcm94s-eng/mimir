import type { ModelInput, ModelOutput } from '@mimir/shared-types';

export interface ProviderInvokeOptions {
  tier: 0 | 1 | 2;
  model?: string;
}

export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedTiers: ReadonlyArray<0 | 1 | 2>;
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
