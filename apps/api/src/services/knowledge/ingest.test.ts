import { describe, expect, it } from 'vitest';
import { chunkText, computeContentHash, generateFakeEmbedding } from './ingest';

describe('chunkText', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkText('', { chunkSize: 10, overlap: 2 })).toEqual([]);
  });

  it('returns the full text as a single chunk when it fits', () => {
    const text = 'short text';
    expect(chunkText(text, { chunkSize: 100, overlap: 10 })).toEqual([text]);
  });

  it('splits long text into overlapping chunks', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(words, { chunkSize: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }

    // Overlap: the concatenated chunks should contain all original words.
    const joined = chunks.join(' ');
    for (let i = 0; i < 200; i += 1) {
      expect(joined).toContain(`word${i}`);
    }
  });

  it('preserves all content across chunks', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const chunks = chunkText(text, { chunkSize: 20, overlap: 5 });
    const joined = chunks.join(' ');
    expect(joined).toContain('quick');
    expect(joined).toContain('brown');
    expect(joined).toContain('fox');
    expect(joined).toContain('lazy');
    expect(joined).toContain('dog');
  });
});

describe('computeContentHash', () => {
  it('produces a deterministic sha256 hex digest', () => {
    const text = 'hello world';
    const first = computeContentHash(text);
    const second = computeContentHash(text);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different content', () => {
    expect(computeContentHash('a')).not.toBe(computeContentHash('b'));
  });
});

describe('generateFakeEmbedding', () => {
  it('produces a deterministic 768-dimensional unit vector', () => {
    const first = generateFakeEmbedding('test');
    const second = generateFakeEmbedding('test');

    expect(first).toHaveLength(768);
    expect(second).toHaveLength(768);
    expect(first).toEqual(second);

    const norm = Math.sqrt(first.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('produces different vectors for different inputs', () => {
    const a = generateFakeEmbedding('a');
    const b = generateFakeEmbedding('b');
    expect(a).not.toEqual(b);
  });
});
