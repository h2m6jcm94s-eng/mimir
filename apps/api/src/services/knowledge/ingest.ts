import { createHash } from 'node:crypto';
import type { TenantContext } from '../../db/tenant-context';
import { createEmbeddings, createKnowledgeItem } from '../../repositories/knowledge';

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

export async function ingestDocument(
  ctx: TenantContext,
  input: IngestDocumentInput
): Promise<{ itemId: string; chunks: number }> {
  const hash = computeContentHash(input.content);

  const item = await createKnowledgeItem(ctx, {
    kind: input.kind,
    uri: input.uri,
    tier: input.tier,
    hash,
    content: input.content,
    meta: input.meta,
  });

  const chunks = chunkText(input.content);
  if (chunks.length === 0) {
    return { itemId: item.id, chunks: 0 };
  }

  const embeddings = chunks.map((text, idx) => ({
    knowledgeItemId: item.id,
    chunkIdx: idx,
    text,
    vector: generateFakeEmbedding(text),
    meta: {},
  }));

  await createEmbeddings(ctx, embeddings);

  return { itemId: item.id, chunks: embeddings.length };
}

// Unused but exported for clarity: embedding generation should call a real model.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateOpenAiEmbedding(_text: string): Promise<number[]> {
  // TODO: wire to OpenAI embeddings API once the schema dimension matches the model output.
  throw new Error('Real embedding generation is not enabled in the foundational release');
}
