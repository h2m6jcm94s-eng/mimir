import { createHash } from 'node:crypto';
import type { TenantContext } from '../../db/tenant-context';
import { createEmbeddings, createKnowledgeItem } from '../../repositories/knowledge';
import { ClassificationGateway } from '../classification/gateway';
import { LocalModelRuntime } from '../models/local-runtime';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface IngestDocumentInput {
  kind: 'doc' | 'code' | 'screenshot' | 'web';
  uri?: string | null;
  content: string;
  tier?: number;
  meta?: Record<string, unknown>;
}

export interface IngestDocumentResult {
  itemId: string;
  chunks: number;
  tier: number;
  classification: {
    tier: 0 | 1 | 2;
    confidence: number;
    reason: string;
    fallback: boolean;
    policyVersion: string;
  };
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 512;
  const overlap = options.overlap ?? 64;

  if (!text || text.length <= chunkSize) {
    return text ? [text] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start) {
        end = boundary;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + chunkSize - overlap, end);
  }

  return chunks;
}

export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generates a deterministic 768-dimensional unit vector from a text seed.
 * This is a placeholder for a real embedding model; it avoids API cost and
 * dimension mismatches while still allowing vector storage to be exercised.
 */
export function generateFakeEmbedding(text: string): number[] {
  const seed = createHash('sha256').update(text).digest();
  const vector: number[] = [];
  let sum = 0;

  for (let i = 0; i < 768; i += 1) {
    // Use 4 bytes per float to get a deterministic value in [-1, 1].
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

function classifyDocument(input: IngestDocumentInput) {
  const classifier = new ClassificationGateway();
  const promptParts = [`[kind:${input.kind}]`];
  if (input.uri) promptParts.push(`[uri:${input.uri}]`);
  promptParts.push(input.content);
  return classifier.classify({
    prompt: promptParts.join(' '),
    attachments: [],
    retrievedContext: [],
  });
}

export async function ingestDocument(
  ctx: TenantContext,
  input: IngestDocumentInput
): Promise<IngestDocumentResult> {
  const hash = computeContentHash(input.content);
  const classification =
    input.tier === undefined
      ? classifyDocument(input)
      : {
          tier: input.tier as 0 | 1 | 2,
          confidence: 1,
          reason: 'Tier provided by client',
          fallback: false,
          policyVersion: 'explicit',
        };

  const item = await createKnowledgeItem(ctx, {
    kind: input.kind,
    uri: input.uri,
    tier: classification.tier,
    hash,
    content: input.content,
    meta: input.meta,
  });

  const chunks = chunkText(input.content);
  if (chunks.length === 0) {
    return { itemId: item.id, chunks: 0, tier: classification.tier, classification };
  }

  const embeddings = await Promise.all(
    chunks.map(async (text, idx) => ({
      knowledgeItemId: item.id,
      chunkIdx: idx,
      text,
      vector: await generateEmbeddingForTier(ctx, text, classification.tier),
      meta: {},
    }))
  );

  await createEmbeddings(ctx, embeddings);

  return {
    itemId: item.id,
    chunks: embeddings.length,
    tier: classification.tier,
    classification,
  };
}

async function generateEmbeddingForTier(
  ctx: TenantContext,
  text: string,
  tier: 0 | 1 | 2
): Promise<number[]> {
  if (tier === 0) {
    try {
      const runtime = new LocalModelRuntime(ctx);
      const result = await runtime.embed(text);
      return result.vector;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(
        `[ingest] T0 local embedding failed, falling back to fake embedding: ${message}`
      );
    }
  }
  return generateFakeEmbedding(text);
}

// Unused but exported for clarity: embedding generation should call a real model.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateOpenAiEmbedding(_text: string): Promise<number[]> {
  // TODO: wire to OpenAI embeddings API once the schema dimension matches the model output.
  throw new Error('Real embedding generation is not enabled in the foundational release');
}
