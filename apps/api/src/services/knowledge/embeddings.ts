import { createHash } from 'node:crypto';

function getEnv(name: string): string | undefined {
  return process.env[name];
}

export function generateFakeEmbedding(text: string): number[] {
  const seed = createHash('sha256').update(text).digest();
  const vector: number[] = [];
  let sum = 0;

  for (let i = 0; i < 768; i += 1) {
    const offset = (i * 4) % seed.length;
    const bytes = seed.subarray(offset, offset + 4);
    const uint = bytes.readUInt32LE(0);
    const value = (uint % 2000001) / 1000000 - 1;
    vector.push(value);
    sum += value * value;
  }

  const norm = Math.sqrt(sum) || 1;
  return vector.map((v) => v / norm);
}

export interface EmbeddingResult {
  vector: number[];
  dimension: number;
}

export async function generateOpenAiEmbedding(
  text: string,
  model = 'text-embedding-3-small'
): Promise<EmbeddingResult> {
  const apiKey = getEnv('OPENAI_API_KEY');
  const baseUrl = getEnv('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions: 768,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embedding request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`OpenAI embedding error: ${data.error.message ?? 'unknown'}`);
  }

  const vector = data.data?.[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error('OpenAI embedding response contained no embedding vector');
  }

  return { vector, dimension: vector.length };
}

/**
 * Generate a 768-dimensional embedding for the given text.
 * Prefers OpenAI when OPENAI_API_KEY is configured; otherwise falls back to
 * a deterministic fake embedding so local/offline development still works.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (getEnv('OPENAI_API_KEY')) {
    try {
      return await generateOpenAiEmbedding(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(`[embeddings] OpenAI embedding failed, falling back to fake: ${message}`);
    }
  }

  const vector = generateFakeEmbedding(text);
  return { vector, dimension: vector.length };
}
