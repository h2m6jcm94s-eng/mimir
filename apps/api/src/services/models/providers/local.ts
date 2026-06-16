import type { ModelInput, ModelOutput } from '@mimir/shared-types';
import type { ModelProvider, ProviderInvokeOptions } from './types';

export class LocalProvider implements ModelProvider {
  readonly id = 'local';
  readonly name = 'Local (stub)';
  readonly supportedTiers = [0, 1, 2] as const;
  setupHint = 'No configuration required.';

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
