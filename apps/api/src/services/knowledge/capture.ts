import type { TenantContext } from '../../db/tenant-context';
import { createKnowledgeLink, findNoteByTitle } from '../../repositories/knowledge';
import { createNote, getItem, listItemLinks } from './second-brain';

export interface CaptureInput {
  content: string;
  tier?: number;
  tags?: string[];
}

export interface CaptureResult {
  itemId: string;
  title: string;
  links: { targetId: string; title: string }[];
}

function extractLinkTitles(content: string): string[] {
  const matches = content.matchAll(/\[\[(.*?)\]\]/g);
  return Array.from(
    new Set(
      Array.from(matches)
        .map((m) => m[1].trim())
        .filter(Boolean)
    )
  );
}

function makeTitle(content: string): string {
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n')[0] ?? trimmed;
  return firstLine.slice(0, 80);
}

export async function captureNote(ctx: TenantContext, input: CaptureInput): Promise<CaptureResult> {
  const title = makeTitle(input.content);
  const linkTitles = extractLinkTitles(input.content);

  const source = await createNote(ctx, {
    title,
    content: input.content,
    tier: input.tier,
    tags: input.tags,
  });

  const links: { targetId: string; title: string }[] = [];

  for (const linkTitle of linkTitles) {
    let target = await findNoteByTitle(ctx, linkTitle);
    if (!target) {
      const created = await createNote(ctx, {
        title: linkTitle,
        content: '',
        tier: input.tier,
        tags: [],
      });
      target = created.item;
    }

    await createKnowledgeLink(ctx, {
      sourceId: source.itemId,
      targetId: target.id,
      kind: 'link',
    });

    links.push({ targetId: target.id, title: linkTitle });
  }

  return { itemId: source.itemId, title, links };
}

export async function getRelatedNotes(ctx: TenantContext, id: string) {
  const item = await getItem(ctx, id);
  if (!item) return null;

  const { outbound, inbound } = await listItemLinks(ctx, id);
  return {
    item,
    outbound: outbound.map((l) => l.target),
    inbound: inbound.map((l) => l.source),
  };
}
