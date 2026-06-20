import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIER,
  capturePageData,
  captureSelectionData,
  formatCapture,
  isExtensionPage,
} from './extract';

describe('formatCapture', () => {
  it('formats a page capture as markdown with title, url and body', () => {
    const payload = formatCapture('page', {
      title: 'Example Domain',
      url: 'https://example.com',
      text: 'This domain is for use in illustrative examples.',
    });

    expect(payload.content).toContain('# Example Domain');
    expect(payload.content).toContain('Source: https://example.com');
    expect(payload.content).toContain('This domain is for use in illustrative examples.');
    expect(payload.tier).toBe(DEFAULT_TIER);
    expect(payload.tags).toBeUndefined();
  });

  it('labels a selection capture', () => {
    const payload = formatCapture('selection', {
      title: 'Docs',
      url: 'https://docs.example.com',
      text: 'Selected text',
    });

    expect(payload.content).toContain('## Selection');
    expect(payload.content).toContain('Selected text');
  });

  it('includes tags and tier when provided', () => {
    const payload = formatCapture(
      'page',
      { title: 'T', url: 'https://t.co', text: 'body' },
      { tags: ['read-later', 'work'], tier: 1 }
    );

    expect(payload.tags).toEqual(['read-later', 'work']);
    expect(payload.tier).toBe(1);
  });

  it('falls back to an untitled heading', () => {
    const payload = formatCapture('page', { title: '', url: 'https://x', text: 'body' });
    expect(payload.content).toContain('# Untitled capture');
  });
});

describe('isExtensionPage', () => {
  it('returns true for chrome and about pages', () => {
    expect(isExtensionPage('chrome://extensions/')).toBe(true);
    expect(isExtensionPage('chrome-extension://abc/popup.html')).toBe(true);
    expect(isExtensionPage('about:blank')).toBe(true);
  });

  it('returns false for regular web pages', () => {
    expect(isExtensionPage('https://example.com')).toBe(false);
    expect(isExtensionPage('http://localhost:3000')).toBe(false);
  });
});

describe('capturePageData', () => {
  it('extracts title, url and body text from a document', () => {
    const document = {
      title: 'Hello',
      location: { href: 'https://example.com/page' },
      body: { innerText: 'Body text' },
    } as unknown as Document;

    expect(capturePageData(document)).toEqual({
      title: 'Hello',
      url: 'https://example.com/page',
      text: 'Body text',
    });
  });
});

describe('captureSelectionData', () => {
  it('extracts the current selection', () => {
    const document = {
      title: 'Hello',
      location: { href: 'https://example.com/page' },
      getSelection: () => ({ toString: () => 'selected text' }),
    } as unknown as Document;

    expect(captureSelectionData(document)).toEqual({
      title: 'Hello',
      url: 'https://example.com/page',
      text: 'selected text',
    });
  });
});
