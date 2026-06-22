import { describe, expect, it } from 'vitest';
import { ClassificationGateway } from './gateway';

describe('classification gateway conformance', () => {
  const gateway = new ClassificationGateway();

  it('falls back to tier 0 when confidence is below threshold', () => {
    const result = gateway.classify({
      prompt: 'a completely neutral prompt with no matching signals',
      attachments: [],
      retrievedContext: [],
    });

    expect(result.fallback).toBe(true);
    expect(result.tier).toBe(0);
    expect(result.confidence).toBeLessThan(0.85);
  });

  it('never widens tier when fallback is true', () => {
    const prompts = [
      'check the weather',
      'summarize this public article',
      'a totally unknown request',
      'render my video', // local compute signal but no explicit public/sensitive signals
    ];

    for (const prompt of prompts) {
      const result = gateway.classify({ prompt, attachments: [], retrievedContext: [] });
      if (result.fallback) {
        expect(result.tier).toBe(0);
      }
    }
  });

  it('forces tier 0 for PII or secrets regardless of other signals', () => {
    const prompts = [
      'summarize my ssn 123-45-6789 and password: supersecret',
      'send an email with api_key=sk-1234567890abcdef',
      'my passport number is X1234567, what is the weather?',
    ];

    for (const prompt of prompts) {
      const result = gateway.classify({ prompt, attachments: [], retrievedContext: [] });
      expect(result.tier).toBe(0);
    }
  });

  it('permits tier 2 only for high-confidence public tasks with no sensitive signals', () => {
    const result = gateway.classify({
      prompt: 'summarize this public article, check the weather, and open a public page',
      attachments: [],
      retrievedContext: [],
    });

    expect(result.tier).toBe(2);
    expect(result.fallback).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('returns a tier that is one of the allowed policy tiers', () => {
    const prompts = [
      'say hello',
      'my password is secret',
      'render this on my desktop',
      'summarize this public article',
    ];

    for (const prompt of prompts) {
      const result = gateway.classify({ prompt, attachments: [], retrievedContext: [] });
      expect([0, 1, 2]).toContain(result.tier);
    }
  });
});
