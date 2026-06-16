import type { ModelProviderConfig, ModelProviderEntry } from '@mimir/shared-types';
import { AnthropicMessagesProvider, AnthropicProvider } from './providers/anthropic';
import { LocalProvider } from './providers/local';
import { OllamaProvider } from './providers/ollama';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { getEnv } from './providers/types';
import type { ModelProvider } from './providers/types';

export interface RegistryStatus {
  tier: 0 | 1 | 2;
  provider: string;
  model?: string;
  available: boolean;
  hint?: string;
}

const allProviders: Record<string, () => ModelProvider> = {
  local: () => new LocalProvider(),
  openai: () => new OpenAICompatibleProvider('openai', 'OpenAI'),
  kimi: () => {
    // Kimi Code plan keys (sk-kimi-*) use the Kimi Code Anthropic-compatible
    // endpoint rather than the Moonshot Open Platform.
    const key = getEnv('KIMI_API_KEY');
    if (key?.startsWith('sk-kimi')) {
      return new AnthropicMessagesProvider({
        id: 'kimi',
        name: 'Kimi',
        apiKeyName: 'KIMI_API_KEY',
        baseUrlName: 'KIMI_BASE_URL',
        defaultBaseUrl: 'https://api.kimi.com/coding/v1',
        defaultModel: 'kimi-for-coding',
      });
    }
    return new OpenAICompatibleProvider('kimi', 'Kimi');
  },
  qwen: () => new OpenAICompatibleProvider('qwen', 'Qwen'),
  groq: () => new OpenAICompatibleProvider('groq', 'Groq'),
  anthropic: () => new AnthropicProvider(),
  ollama: () => new OllamaProvider(),
};

export class ProviderRegistry {
  private providers: Record<number, ModelProvider[]> = { 0: [], 1: [], 2: [] };

  constructor(config: ModelProviderConfig) {
    for (const tierKey of [0, 1, 2] as const) {
      const entries = config[tierKey];
      this.providers[tierKey] = entries
        .map((entry) => this.buildProvider(entry))
        .filter((p): p is ModelProvider => p !== null);
    }
  }

  private buildProvider(entry: ModelProviderEntry): ModelProvider | null {
    const factory = allProviders[entry.provider];
    if (!factory) {
      console.warn(`Unknown model provider "${entry.provider}" — skipping.`);
      return null;
    }
    const provider = factory();
    if (entry.model) {
      // Allow per-entry model override by wrapping invoke.
      const baseInvoke = provider.invoke.bind(provider);
      provider.invoke = async (input, options) => {
        return baseInvoke(input, { ...options, model: entry.model });
      };
    }
    return provider;
  }

  getAvailable(tier: 0 | 1 | 2): ModelProvider[] {
    return this.providers[tier].filter((p) => p.isAvailable());
  }

  getStatus(): RegistryStatus[] {
    const statuses: RegistryStatus[] = [];
    for (const tier of [0, 1, 2] as const) {
      for (const provider of this.providers[tier]) {
        statuses.push({
          tier,
          provider: provider.name,
          model: provider instanceof LocalProvider ? undefined : provider.id,
          available: provider.isAvailable(),
          hint: provider.isAvailable() ? undefined : provider.setupHint,
        });
      }
    }
    return statuses;
  }

  find(tier: 0 | 1 | 2, providerId?: string): ModelProvider | undefined {
    const candidates = this.providers[tier];
    if (providerId) {
      return candidates.find((p) => p.id === providerId && p.isAvailable());
    }
    return candidates.find((p) => p.isAvailable());
  }
}
