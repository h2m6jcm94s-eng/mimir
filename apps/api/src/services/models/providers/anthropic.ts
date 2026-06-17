import type { ModelInput, ModelOutput, ProviderId } from '@mimir/shared-types';
import { computeCostUsd } from '../pricing';
import type { ModelProvider, ProviderInvokeOptions } from './types';
import { getEnv } from './types';

export interface AnthropicMessagesOptions {
  id?: ProviderId;
  name?: string;
  apiKeyName?: string;
  baseUrlName?: string;
  defaultBaseUrl?: string;
  defaultModel?: string;
}

export class AnthropicMessagesProvider implements ModelProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly supportedTiers = [2] as const;
  readonly local = false;
  setupHint: string;

  private apiKeyName: string;
  private baseUrlName: string;
  private defaultBaseUrl: string;
  private defaultModel: string;

  constructor(options: AnthropicMessagesOptions = {}) {
    this.id = options.id ?? 'anthropic';
    this.name = options.name ?? 'Anthropic Claude';
    this.apiKeyName = options.apiKeyName ?? 'ANTHROPIC_API_KEY';
    this.baseUrlName = options.baseUrlName ?? 'ANTHROPIC_BASE_URL';
    this.defaultBaseUrl = options.defaultBaseUrl ?? 'https://api.anthropic.com/v1';
    this.defaultModel = options.defaultModel ?? 'claude-3-5-sonnet-20241022';
    this.setupHint = `Set ${this.apiKeyName} to enable ${this.name}.`;
  }

  private getCredentials() {
    return {
      apiKey: getEnv(this.apiKeyName),
      baseUrl: getEnv(this.baseUrlName) || this.defaultBaseUrl,
    };
  }

  isAvailable(): boolean {
    return Boolean(this.getCredentials().apiKey);
  }

  async invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput> {
    const { apiKey, baseUrl } = this.getCredentials();
    if (!apiKey) {
      throw new Error(`${this.name} is not configured. ${this.setupHint}`);
    }

    const model = options.model ?? input.model ?? this.defaultModel;
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1024,
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${this.name} request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`${this.name} error: ${data.error.message ?? 'unknown'}`);
    }

    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const usage = data.usage
      ? {
          promptTokens,
          completionTokens,
          totalTokens,
        }
      : undefined;
    const costUsd = usage ? computeCostUsd(model, promptTokens, completionTokens) : undefined;
    return {
      text,
      model,
      provider: this.id,
      tier: options.tier,
      usage,
      costUsd,
    };
  }
}

export class AnthropicProvider extends AnthropicMessagesProvider {}
