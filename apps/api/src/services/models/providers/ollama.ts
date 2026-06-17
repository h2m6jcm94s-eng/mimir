import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { ModelProvider, ProviderInvokeOptions } from './types';
import { getEnv } from './types';

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama (local)';
  readonly supportedTiers = [0, 1] as const;
  readonly local = true;
  setupHint = 'Set OLLAMA_BASE_URL to enable Ollama (default: http://localhost:11434).';

  private getBaseUrl(): string {
    return getEnv('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
  }

  isAvailable(): boolean {
    // Treat Ollama as available when the user has explicitly configured it or
    // left the default localhost endpoint. Actual reachability is checked at
    // invoke time.
    return true;
  }

  async invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput> {
    const baseUrl = this.getBaseUrl();
    const model = options.model ?? input.model ?? 'llama3.1';

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { response?: string; error?: string };
    if (data.error) {
      throw new Error(`Ollama error: ${data.error}`);
    }

    return {
      text: data.response ?? '',
      model,
      provider: 'ollama',
      tier: options.tier,
    };
  }
}
