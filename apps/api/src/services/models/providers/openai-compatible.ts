import type { ModelInput, ModelOutput, ProviderId } from '@mimir/shared-types';
import type { ModelProvider, ProviderInvokeOptions } from './types';
import { getEnv } from './types';

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  kimi: 'https://api.moonshot.cn/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  groq: 'https://api.groq.com/openai/v1',
};

const API_KEY_NAMES: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  kimi: 'KIMI_API_KEY',
  qwen: 'QWEN_API_KEY',
  groq: 'GROQ_API_KEY',
};

const BASE_URL_NAMES: Record<string, string> = {
  openai: 'OPENAI_BASE_URL',
  kimi: 'KIMI_BASE_URL',
  qwen: 'QWEN_BASE_URL',
  groq: 'GROQ_BASE_URL',
};

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly supportedTiers = [1, 2] as const;
  setupHint: string;

  constructor(id: 'openai' | 'kimi' | 'qwen' | 'groq', name: string) {
    this.id = id;
    this.name = name;
    this.setupHint = `Set ${API_KEY_NAMES[id]} to enable ${name}.`;
  }

  private getCredentials() {
    const envUrl = getEnv(BASE_URL_NAMES[this.id]);
    return {
      apiKey: getEnv(API_KEY_NAMES[this.id]),
      baseUrl: envUrl && envUrl.trim() !== '' ? envUrl : DEFAULT_BASE_URLS[this.id],
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

    const model = options.model ?? input.model ?? this.fallbackModel();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${this.name} request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`${this.name} error: ${data.error.message ?? 'unknown'}`);
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    return {
      text,
      model,
      provider: this.id,
      tier: options.tier,
    };
  }

  private fallbackModel(): string {
    const defaults: Record<string, string> = {
      openai: 'gpt-4o-mini',
      kimi: 'moonshot-v1-8k',
      qwen: 'qwen-turbo',
      groq: 'llama-3.1-8b-instant',
    };
    return defaults[this.id];
  }
}
