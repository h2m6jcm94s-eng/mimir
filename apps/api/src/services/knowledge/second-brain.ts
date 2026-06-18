import { createHash } from 'node:crypto';
import type * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import {
  createEmbeddings,
  createKnowledgeItem,
  createKnowledgeLink,
  deleteKnowledgeLink,
  getKnowledgeGraph,
  getKnowledgeItemById,
  listKnowledgeLinks,
  listNotes,
} from '../../repositories/knowledge';
import { ClassificationGateway } from '../classification/gateway';

export interface CreateNoteInput {
  title: string;
  content: string;
  tier?: number;
  tags?: string[];
}

export interface CreateNoteResult {
  itemId: string;
  chunks: number;
  tier: number;
  item: typeof schema.knowledgeItem.$inferSelect;
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function chunkText(text: string, options: { chunkSize?: number; overlap?: number } = {}): string[] {
  const chunkSize = options.chunkSize ?? 512;
  const overlap = options.overlap ?? 64;
  if (!text || text.length <= chunkSize) return text ? [text] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start) end = boundary;
    }
    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + chunkSize - overlap, end);
  }
  return chunks;
}

function generateFakeEmbedding(text: string): number[] {
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

function classifyNote(input: CreateNoteInput) {
  const classifier = new ClassificationGateway();
  return classifier.classify({
    prompt: `[kind:note] [title:${input.title}] ${input.content}`,
    attachments: [],
    retrievedContext: [],
  });
}

export async function createNote(
  ctx: TenantContext,
  input: CreateNoteInput
): Promise<CreateNoteResult> {
  const hash = computeContentHash(input.content);
  const classification =
    input.tier === undefined
      ? classifyNote(input)
      : {
          tier: input.tier as 0 | 1 | 2,
          confidence: 1,
          reason: 'Tier provided by client',
          fallback: false,
          policyVersion: 'explicit',
        };

  const item = await createKnowledgeItem(ctx, {
    kind: 'note',
    uri: null,
    tier: classification.tier,
    hash,
    content: input.content,
    meta: { title: input.title, tags: input.tags ?? [] },
  });

  const chunks = chunkText(input.content);
  if (chunks.length > 0) {
    const embeddings = chunks.map((text, idx) => ({
      knowledgeItemId: item.id,
      chunkIdx: idx,
      text,
      vector: generateFakeEmbedding(text),
      meta: {},
    }));
    await createEmbeddings(ctx, embeddings);
  }

  return { itemId: item.id, chunks: chunks.length, tier: classification.tier, item };
}

export async function listNotesService(ctx: TenantContext, input: { limit: number }) {
  return listNotes(ctx, input);
}

export async function getItem(ctx: TenantContext, id: string) {
  return getKnowledgeItemById(ctx, id);
}

export async function linkItems(
  ctx: TenantContext,
  input: { sourceId: string; targetId: string; kind?: string }
) {
  return createKnowledgeLink(ctx, input);
}

export async function listItemLinks(ctx: TenantContext, itemId: string) {
  return listKnowledgeLinks(ctx, itemId);
}

export async function removeLink(ctx: TenantContext, linkId: string): Promise<boolean> {
  return deleteKnowledgeLink(ctx, linkId);
}

export async function getGraph(ctx: TenantContext, input: { limit: number }) {
  return getKnowledgeGraph(ctx, input);
}
