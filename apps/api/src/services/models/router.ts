export interface ModelInput {
  prompt: string;
  payload: Record<string, unknown>;
}

export interface ModelOutput {
  text: string;
  model: string;
  tier: 0 | 1 | 2;
}

export interface ModelAdapter {
  readonly name: string;
  readonly tier: 0 | 1 | 2;
  invoke(input: ModelInput): Promise<ModelOutput>;
}

class LocalAdapter implements ModelAdapter {
  readonly name = 'local';
  readonly tier = 0 as const;

  async invoke(input: ModelInput): Promise<ModelOutput> {
    return {
      text: `[local] processed: ${input.prompt}`,
      model: this.name,
      tier: this.tier,
    };
  }
}

class SelfHostedAdapter implements ModelAdapter {
  readonly name = 'self-hosted';
  readonly tier = 1 as const;

  async invoke(input: ModelInput): Promise<ModelOutput> {
    return {
      text: `[self-hosted] processed: ${input.prompt}`,
      model: this.name,
      tier: this.tier,
    };
  }
}

class CloudAdapter implements ModelAdapter {
  readonly name = 'cloud';
  readonly tier = 2 as const;

  async invoke(input: ModelInput): Promise<ModelOutput> {
    return {
      text: `[cloud] processed: ${input.prompt}`,
      model: this.name,
      tier: this.tier,
    };
  }
}

const adapters: Record<number, ModelAdapter> = {
  0: new LocalAdapter(),
  1: new SelfHostedAdapter(),
  2: new CloudAdapter(),
};

export class ModelRouter {
  route(tier: 0 | 1 | 2): ModelAdapter {
    return adapters[tier] ?? adapters[0];
  }

  async invoke(tier: 0 | 1 | 2, input: ModelInput): Promise<ModelOutput> {
    const adapter = this.route(tier);
    return adapter.invoke(input);
  }
}
