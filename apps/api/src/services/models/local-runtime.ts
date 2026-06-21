import type {
  LocalModelConfig,
  LocalModelInfo,
  LocalModelStatus,
  UpsertLocalModelConfigRequest,
} from '@mimir/shared-types';
import type * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import { getLocalModelConfig, upsertLocalModelConfig } from '../../repositories/local-model';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding';

export type OllamaTag = {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  modified_at?: string;
};

export type OllamaTagsResponse = {
  models?: OllamaTag[];
};

export type OllamaPullRequest = {
  model: string;
  stream?: boolean;
};

export const DEFAULT_LOCAL_CONFIG: UpsertLocalModelConfigRequest = {
  baseUrl: 'http://localhost:11434',
  chatModel: 'mimir-local',
  embeddingModel: 'nomic-embed-text',
  embeddingDimension: 768,
  enabled: true,
};

export class LocalModelRuntime {
  constructor(private ctx: TenantContext) {}

  async getOrCreateConfig(): Promise<LocalModelConfig> {
    const existing = await getLocalModelConfig(this.ctx);
    if (existing) {
      return this.toSharedConfig(existing);
    }
    const created = await upsertLocalModelConfig(this.ctx, DEFAULT_LOCAL_CONFIG);
    return this.toSharedConfig(created);
  }

  async upsertConfig(input: UpsertLocalModelConfigRequest): Promise<LocalModelConfig> {
    const row = await upsertLocalModelConfig(this.ctx, input);
    return this.toSharedConfig(row);
  }

  async getStatus(): Promise<LocalModelStatus> {
    const config = await this.getOrCreateConfig();
    if (!config.enabled) {
      return {
        reachable: false,
        baseUrl: config.baseUrl,
        models: [],
        chatAvailable: false,
        embedAvailable: false,
        error: 'Local models are disabled for this tenant',
      };
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const body = await response.text();
        return {
          reachable: false,
          baseUrl: config.baseUrl,
          models: [],
          chatAvailable: false,
          embedAvailable: false,
          error: `Ollama returned ${response.status}: ${body}`,
        };
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const models = (data.models ?? []).map(this.toLocalModelInfo);

      const chatAvailable = models.some(
        (m) => m.name === config.chatModel || m.name.startsWith(`${config.chatModel}:`)
      );
      const embedAvailable = models.some(
        (m) => m.name === config.embeddingModel || m.name.startsWith(`${config.embeddingModel}:`)
      );

      return {
        reachable: true,
        baseUrl: config.baseUrl,
        models,
        chatAvailable,
        embedAvailable,
        defaultChatModel: config.chatModel,
        defaultEmbedModel: config.embeddingModel,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        reachable: false,
        baseUrl: config.baseUrl,
        models: [],
        chatAvailable: false,
        embedAvailable: false,
        error: `Could not reach Ollama: ${message}`,
      };
    }
  }

  async listModels(): Promise<LocalModelInfo[]> {
    const config = await this.getOrCreateConfig();
    if (!config.enabled) {
      return [];
    }

    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama list models failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? []).map(this.toLocalModelInfo);
  }

  async pullModel(model: string): Promise<{ jobId: string }> {
    const config = await this.getOrCreateConfig();
    if (!config.enabled) {
      throw new Error('LOCAL_MODEL_DISABLED');
    }

    const response = await fetch(`${config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false } as OllamaPullRequest),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama pull failed (${response.status}): ${body}`);
    }

    // In a full implementation this would queue a Temporal job and return its ID.
    // For the first slice we treat the synchronous pull as a completed job and
    // return a stable synthetic job id so the API contract is satisfied.
    const jobId = crypto.randomUUID();
    return { jobId };
  }

  async setupMimirLocalModel(): Promise<{ jobId: string }> {
    const config = await this.getOrCreateConfig();
    if (!config.enabled) {
      throw new Error('LOCAL_MODEL_DISABLED');
    }

    const baseModel = 'qwen3:8b';
    const pullResponse = await fetch(`${config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: baseModel, stream: false } as OllamaPullRequest),
      signal: AbortSignal.timeout(300000),
    });

    if (!pullResponse.ok) {
      const body = await pullResponse.text();
      throw new Error(`Mimir Local base-model pull failed (${pullResponse.status}): ${body}`);
    }

    const modelfile = `FROM qwen3:8b

SYSTEM """
You are Mimir, a privacy-first AI companion built to help humans without selling them out.
You serve one person or team at a time, running on hardware they control whenever possible.
You remember context from previous conversations, documents, and routines only when that
information has been explicitly stored in the user's Mimir memory or knowledge base.

When answering:
- Be concise unless the user asks for depth.
- Cite sources when you retrieve facts from the user's knowledge base.
- Prefer tools, connectors, and routines when the user asks you to act on their behalf.
- Respect privacy tiers: never suggest sending T0/private data to a cloud service.
- If you don't know something and it isn't in the user's data, say so rather than inventing it.

You are not a generic assistant. You are Mimir: helpful, deterministic, and trustworthy.
"""

PARAMETER temperature 0.7
PARAMETER num_ctx 8192
`;

    const createResponse = await fetch(`${config.baseUrl}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'mimir-local', modelfile }),
      signal: AbortSignal.timeout(120000),
    });

    if (!createResponse.ok) {
      const body = await createResponse.text();
      throw new Error(`Mimir Local model creation failed (${createResponse.status}): ${body}`);
    }

    await upsertLocalModelConfig(this.ctx, {
      ...config,
      chatModel: 'mimir-local',
    });

    const jobId = crypto.randomUUID();
    return { jobId };
  }

  async embed(text: string): Promise<{ vector: number[]; dimension: number }> {
    const config = await this.getOrCreateConfig();
    if (!config.enabled) {
      throw new Error('LOCAL_MODEL_DISABLED');
    }

    const provider = new OllamaEmbeddingProvider({
      baseUrl: config.baseUrl,
      embeddingModel: config.embeddingModel,
    });

    const result = await provider.embed(text);
    if (result.dimension !== config.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch: config expects ${config.embeddingDimension}, got ${result.dimension}`
      );
    }
    return result;
  }

  private toLocalModelInfo(tag: OllamaTag): LocalModelInfo {
    return {
      name: tag.name,
      size: tag.size,
      digest: tag.digest,
      modifiedAt: tag.modified_at,
    };
  }

  private toSharedConfig(row: typeof schema.localModelConfig.$inferSelect): LocalModelConfig {
    return {
      id: row.id,
      tenantId: row.tenantId,
      baseUrl: row.baseUrl,
      chatModel: row.chatModel,
      embeddingModel: row.embeddingModel,
      embeddingDimension: row.embeddingDimension,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
