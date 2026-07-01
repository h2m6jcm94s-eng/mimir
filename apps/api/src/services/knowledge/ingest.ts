import { createHash } from 'node:crypto';
import type { TenantContext } from '../../db/tenant-context';
import { createEmbeddings, createKnowledgeItem } from '../../repositories/knowledge';
import { getClassificationGateway } from '../classification/gateway';
import { LocalModelRuntime } from '../models/local-runtime';
import { generateEmbedding as generateCloudEmbedding, generateFakeEmbedding } from './embeddings';

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

function classifyDocument(input: IngestDocumentInput) {
  const classifier = getClassificationGateway();
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

export async function generateEmbeddingForTier(
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
    return generateFakeEmbedding(text);
  }

  try {
    const result = await generateCloudEmbedding(text);
    return result.vector;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn(`[ingest] Cloud embedding failed, falling back to fake embedding: ${message}`);
    return generateFakeEmbedding(text);
  }
}

export { generateFakeEmbedding } from './embeddings';
