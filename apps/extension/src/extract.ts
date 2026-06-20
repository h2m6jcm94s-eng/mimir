import type { CaptureData, CaptureMode, CapturePayload } from './types';

export const DEFAULT_API_URL = 'http://localhost:3001';
export const DEFAULT_TIER = 0;

export function formatCapture(
  mode: CaptureMode,
  data: CaptureData,
  options: { tags?: string[]; tier?: number } = {}
): CapturePayload {
  const tags = options.tags?.filter(Boolean) ?? [];
  const tier = options.tier ?? DEFAULT_TIER;

  const heading = data.title.trim() || 'Untitled capture';
  const lines: string[] = [];
  lines.push(`# ${heading}`);
  lines.push('');
  lines.push(`Source: ${data.url}`);
  lines.push('');

  if (mode === 'selection') {
    lines.push('## Selection');
  }

  lines.push(data.text.trim());

  return {
    content: lines.join('\n'),
    tier,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export function isExtensionPage(url: string): boolean {
  return (
    url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')
  );
}

export function capturePageData(document: Document): CaptureData {
  const title = document.title ?? '';
  const url = document.location?.href ?? '';
  const text = document.body?.innerText ?? '';
  return { title, url, text };
}

export function captureSelectionData(document: Document): CaptureData {
  const title = document.title ?? '';
  const url = document.location?.href ?? '';
  const selection = document.getSelection?.();
  const text = selection?.toString() ?? '';
  return { title, url, text };
}
