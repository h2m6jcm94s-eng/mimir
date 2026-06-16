import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { AppConfig } from '../../config';
import { loadConfig } from '../../config';
import { LocalProvider } from './providers/local';
import { ProviderRegistry } from './registry';

export type { ModelInput, ModelOutput } from '@mimir/shared-types';

export interface ModelAdapter {
  readonly name: string;
  readonly tier: 0 | 1 | 2;
  invoke(input: ModelInput): Promise<ModelOutput>;
}

export interface ModelRouterOptions {
  provider?: string;
  model?: string;
}

export class ModelRouter {
  private registry: ProviderRegistry;
  private fallback = new LocalProvider();

  constructor(config?: AppConfig) {
    this.registry = new ProviderRegistry((config ?? loadConfig()).modelProviders);
  }

  route(tier: 0 | 1 | 2, providerId?: string): ModelAdapter {
    const provider = this.registry.find(tier, providerId) ?? this.fallback;
    return {
      name: provider.id,
      tier,
      invoke: (input) =>
        provider.invoke(input, { tier, model: providerId ? undefined : undefined }),
    };
  }

  async invoke(
    tier: 0 | 1 | 2,
    input: ModelInput,
    options?: ModelRouterOptions
  ): Promise<ModelOutput> {
    const provider = this.registry.find(tier, options?.provider) ?? this.fallback;
    return provider.invoke(input, { tier, model: options?.model });
  }

  status() {
    return this.registry.getStatus();
  }
}
