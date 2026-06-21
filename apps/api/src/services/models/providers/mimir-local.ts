import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { TenantContext } from '../../../db/tenant-context';
import { getLocalModelConfig } from '../../../repositories/local-model';
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

const MIMIR_SYSTEM_PROMPT = `You are Mimir, a privacy-first AI companion built to help humans without selling them out.
You serve one person or team at a time, running on hardware they control whenever possible.
You remember context from previous conversations, documents, and routines only when that
information has been explicitly stored in the user's Mimir memory or knowledge base.

When answering:
- Be concise unless the user asks for depth.
- Cite sources when you retrieve facts from the user's knowledge base.
- Prefer tools, connectors, and routines when the user asks you to act on their behalf.
- Respect privacy tiers: never suggest sending T0/private data to a cloud service.
- If you don't know something and it isn't in the user's data, say so rather than inventing it.

You are not a generic assistant. You are Mimir: helpful, deterministic, and trustworthy.`;

export class MimirLocalProvider implements ModelProvider {
  readonly id = 'mimir-local' as const;
  readonly name = 'Mimir Local';
  readonly supportedTiers = [0, 1] as const;
  readonly local = true;
  setupHint =
    'Install Ollama and run ./scripts/setup-mimir-local.sh to download the Mimir Local model.';

  constructor(private defaultBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') {}

  isAvailable(): boolean {
    return true;
  }

  async invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput> {
    const ctx = (options as ProviderInvokeOptions & { ctx?: TenantContext }).ctx;
    const config = ctx ? await getLocalModelConfig(ctx) : null;
    const baseUrl = config?.baseUrl ?? this.defaultBaseUrl;
    const model = options.model ?? input.model ?? config?.chatModel ?? 'mimir-local';

    const messages: OllamaMessage[] = Array.isArray(input.payload?.messages)
      ? (input.payload.messages as OllamaMessage[])
      : [{ role: 'user', content: input.prompt }];

    const hasSystem = messages.some((m) => m.role === 'system');
    if (!hasSystem) {
      messages.unshift({ role: 'system', content: MIMIR_SYSTEM_PROMPT });
    }

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
      throw new Error(`Mimir Local chat request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) {
      throw new Error(`Mimir Local error: ${data.error}`);
    }

    return {
      text: data.message?.content ?? '',
      model,
      provider: 'mimir-local',
      tier: options.tier,
    };
  }
}
