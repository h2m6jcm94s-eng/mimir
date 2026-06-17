import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { AppConfig } from '../../config';
import { loadConfig } from '../../config';
import { CircuitBreaker } from './circuit-breaker';
import { computeCostUsd } from './pricing';
import { LocalProvider } from './providers/local';
import { ProviderRegistry } from './registry';

export type { ModelInput, ModelOutput } from '@mimir/shared-types';

type ModelProviderLike = {
  id: string;
  local: boolean;
  invoke: (
    input: ModelInput,
    options: { tier: 0 | 1 | 2; model?: string; maxTokens?: number }
  ) => Promise<ModelOutput>;
};

export interface ModelAdapter {
  readonly name: string;
  readonly tier: 0 | 1 | 2;
  invoke(input: ModelInput): Promise<ModelOutput>;
}

export interface ModelRouterOptions {
  provider?: string;
  model?: string;
  maxTokens?: number;
}

export class ModelRouter {
  private registry: ProviderRegistry;
  private fallback = new LocalProvider();
  private breakers = new Map<string, CircuitBreaker>();

  constructor(config?: AppConfig) {
    this.registry = new ProviderRegistry((config ?? loadConfig()).modelProviders);
  }

  private getBreaker(providerId: string): CircuitBreaker {
    let breaker = this.breakers.get(providerId);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.breakers.set(providerId, breaker);
    }
    return breaker;
  }

  route(tier: 0 | 1 | 2, providerId?: string): ModelAdapter {
    const provider = this.registry.find(tier, providerId) ?? this.fallback;
    this.assertTierContainment(tier, [provider]);
    return {
      name: provider.id,
      tier,
      invoke: (input) =>
        this.invokeWithFailover(tier, input, [provider], {
          model: providerId ? undefined : undefined,
        }),
    };
  }

  async invoke(
    tier: 0 | 1 | 2,
    input: ModelInput,
    options?: ModelRouterOptions
  ): Promise<ModelOutput> {
    const available = this.registry
      .getAvailable(tier)
      .filter((p) => !this.getBreaker(p.id).isOpen());

    const allowed = this.filterByTier(tier, available);
    let providers = allowed;
    if (options?.provider) {
      const preferredIndex = available.findIndex((p) => p.id === options.provider);
      if (preferredIndex >= 0) {
        const preferred = available[preferredIndex];
        providers = [
          preferred,
          ...available.slice(0, preferredIndex),
          ...available.slice(preferredIndex + 1),
        ];
      }
    }

    return this.invokeWithFailover(tier, input, providers, options);
  }

  private async invokeWithFailover(
    tier: 0 | 1 | 2,
    input: ModelInput,
    providers: ModelProviderLike[],
    options: ModelRouterOptions | undefined
  ): Promise<ModelOutput> {
    this.assertTierContainment(tier, providers);
    if (providers.length === 0) {
      const output = await this.fallback.invoke(input, {
        tier,
        model: options?.model,
        maxTokens: options?.maxTokens,
      });
      return this.attachCost(output);
    }

    const errors: Array<{ provider: string; error: Error }> = [];

    for (const provider of providers) {
      try {
        const output = await provider.invoke(input, {
          tier,
          model: options?.model,
          maxTokens: options?.maxTokens,
        });
        this.getBreaker(provider.id).recordSuccess();
        return this.attachCost(output);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        this.getBreaker(provider.id).recordFailure();
        errors.push({ provider: provider.id, error: normalized });
      }
    }

    const summary = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ');
    const aggregate = new Error(`All model providers failed for tier ${tier}: ${summary}`);
    aggregate.cause = errors;
    throw aggregate;
  }

  private attachCost(output: ModelOutput): ModelOutput {
    if (output.costUsd !== undefined || !output.usage) {
      return output;
    }
    return {
      ...output,
      costUsd: computeCostUsd(
        output.model,
        output.usage.promptTokens,
        output.usage.completionTokens
      ),
    };
  }

  private filterByTier(tier: 0 | 1 | 2, providers: ModelProviderLike[]): ModelProviderLike[] {
    if (tier !== 0) return providers;
    return providers.filter((p) => p.local);
  }

  private assertTierContainment(tier: 0 | 1 | 2, providers: ModelProviderLike[]): void {
    if (tier === 0 && providers.some((p) => !p.local)) {
      throw new Error(
        `TIER_VIOLATION: tier 0 request selected non-local provider(s): ${providers.map((p) => p.id).join(', ')}`
      );
    }
  }

  status() {
    return this.registry.getStatus();
  }
}
