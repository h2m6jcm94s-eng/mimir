import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { ModelProvider, ProviderInvokeOptions } from './types';

export type OllamaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OllamaChatRequest = {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    num_predict?: number;
  };
};

export type OllamaChatResponse = {
  message?: OllamaMessage;
  error?: string;
  done?: boolean;
};

export type OllamaConfig = {
  baseUrl: string;
  chatModel?: string;
};

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama (local)';
  readonly supportedTiers = [0, 1] as const;
  readonly local = true;
  setupHint = 'Set OLLAMA_BASE_URL to enable Ollama (default: http://localhost:11434).';

  constructor(private config: OllamaConfig = { baseUrl: 'http://localhost:11434' }) {}

  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  isAvailable(): boolean {
    return true;
  }

  async invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput> {
    const baseUrl = this.getBaseUrl();
    const model = options.model ?? input.model ?? this.config.chatModel ?? 'llama3.1';

    const messages: OllamaMessage[] = Array.isArray(input.payload?.messages)
      ? (input.payload.messages as OllamaMessage[])
      : [{ role: 'user', content: input.prompt }];

    const body: OllamaChatRequest = {
      model,
      messages,
      stream: false,
      ...(options.maxTokens && { options: { num_predict: options.maxTokens } }),
    };

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama chat request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) {
      throw new Error(`Ollama error: ${data.error}`);
    }

    return {
      text: data.message?.content ?? '',
      model,
      provider: 'ollama',
      tier: options.tier,
    };
  }
}
