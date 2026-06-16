export interface PricePer1M {
  prompt: number;
  completion: number;
}

const MICROS_PER_USD = 1_000_000;
const TOKENS_PER_UNIT = 1_000_000;

const PRICES: Record<string, PricePer1M> = {
  'llama-3.1-8b-instant': { prompt: 0.05, completion: 0.08 },
  'kimi-for-coding': { prompt: 0.5, completion: 1.5 },
  'moonshot-v1-8k': { prompt: 0.5, completion: 0.5 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'qwen-turbo': { prompt: 0.3, completion: 0.6 },
  'claude-3-5-sonnet-20241022': { prompt: 3.0, completion: 12.0 },
  'claude-3-5-sonnet': { prompt: 3.0, completion: 12.0 },
};

export function getModelPrice(model: string): PricePer1M {
  return PRICES[model] ?? { prompt: 0, completion: 0 };
}

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const { prompt, completion } = getModelPrice(model);
  const cost =
    (promptTokens / TOKENS_PER_UNIT) * prompt + (completionTokens / TOKENS_PER_UNIT) * completion;
  return Math.round(cost * MICROS_PER_USD);
}
