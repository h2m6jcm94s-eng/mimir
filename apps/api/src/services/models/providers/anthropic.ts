import type { ModelInput, ModelOutput, ProviderId } from '@mimir/shared-types';
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
      baseUrl: getEnv(this.baseUrlName) ?? this.defaultBaseUrl,
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${this.name} request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`${this.name} error: ${data.error.message ?? 'unknown'}`);
    }

    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    return {
      text,
      model,
      provider: this.id,
      tier: options.tier,
    };
  }
}

export class AnthropicProvider extends AnthropicMessagesProvider {}
