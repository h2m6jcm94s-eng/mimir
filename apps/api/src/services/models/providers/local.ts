import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { ModelProvider, ProviderInvokeOptions } from './types';

export class LocalProvider implements ModelProvider {
  readonly id = 'local';
  readonly name = 'Mimir Local (offline stub)';
  readonly supportedTiers = [0, 1, 2] as const;
  readonly local = true;
  setupHint =
    'Mimir Local is not configured. Install Ollama and download the Mimir Local model from Settings -> Mimir Local.';

  isAvailable(): boolean {
    return true;
  }

  async invoke(input: ModelInput, options: ProviderInvokeOptions): Promise<ModelOutput> {
    return {
      text: `[local] processed: ${input.prompt}`,
      model: input.model ?? 'local',
      provider: 'local',
      tier: options.tier,
    };
  }
}
