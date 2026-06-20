export type OllamaEmbeddingRequest = {
  model: string;
  prompt: string;
};

export type OllamaEmbeddingResponse = {
  embedding?: number[];
  error?: string;
};

export type OllamaEmbeddingConfig = {
  baseUrl: string;
  embeddingModel?: string;
};

export class OllamaEmbeddingProvider {
  constructor(private config: OllamaEmbeddingConfig = { baseUrl: 'http://localhost:11434' }) {}

  async embed(text: string, model?: string): Promise<{ vector: number[]; dimension: number }> {
    const resolvedModel = model ?? this.config.embeddingModel ?? 'nomic-embed-text';
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolvedModel,
        prompt: text,
      } as OllamaEmbeddingRequest),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embedding request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OllamaEmbeddingResponse;
    if (data.error) {
      throw new Error(`Ollama embedding error: ${data.error}`);
    }

    if (!data.embedding || data.embedding.length === 0) {
      throw new Error('Ollama embedding response contained no embedding vector');
    }

    return {
      vector: data.embedding,
      dimension: data.embedding.length,
    };
  }
}
